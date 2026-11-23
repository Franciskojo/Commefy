import "server-only";
import { type ObjectId } from "mongodb";
import { tenantDb } from "@/lib/db/scoped";
import { rawTenantCollection } from "@/lib/db/collections";
import { withTransaction, nextSequence } from "@/lib/db/transaction";
import { computeQuote, type ComputeQuoteInput } from "./pricing";
import { reserveInventory, commitInventory, releaseInventory } from "@/features/inventory/service";
import { getTenantPaymentCredentials } from "@/lib/payments/factory";
import { randomToken, sha256Hex } from "@/lib/security/crypto";
import { Errors } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/service";
import { formatMoney } from "@/lib/money";
import type { Address, OrderDoc, PaymentDoc } from "@/lib/db/types";

export interface CreateOrderInput extends ComputeQuoteInput {
  customerEmail: string;
  customerId?: ObjectId;
  shippingAddress: Address;
  returnUrl: string;
  cancelUrl?: string;
  ip?: string;
}

export async function createCheckoutOrder(input: CreateOrderInput): Promise<{
  order: OrderDoc;
  payment: PaymentDoc;
  checkoutUrl?: string;
  accessToken: string;
}> {
  const db = await tenantDb(input.tenantId);
  const settings = await db.storeSettings.findOne({});
  const reservationMinutes = settings?.checkout?.reservationMinutes || 30;

  // 1. Compute authoritative quote
  const quote = await computeQuote(input);

  // 2. Prepare tokens and sequences
  const accessToken = randomToken(32);
  const accessTokenHash = sha256Hex(accessToken);
  const orderNumber = await nextSequence(`tenant:${input.tenantId.toHexString()}:orderNumber`);

  const reservationExpiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);

  // 3. Obtain payment credentials
  const { provider, credentials } = await getTenantPaymentCredentials(input.tenantId);

  // 4. Atomic transaction: inventory reservation + order creation
  const orderId = new (await import("mongodb")).ObjectId();
  const paymentId = new (await import("mongodb")).ObjectId();

  const initialReference = `sf_${orderId.toHexString()}_${Date.now()}`;

  const orderDoc: OrderDoc = {
    _id: orderId,
    tenantId: input.tenantId,
    orderNumber,
    customerId: input.customerId,
    email: input.customerEmail.toLowerCase().trim(),
    status: "pending_payment",
    currency: quote.currency,
    items: quote.items,
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    shippingTotal: quote.shippingTotal,
    taxTotal: quote.taxTotal,
    total: quote.total,
    refundedTotal: 0,
    pricesIncludeTax: quote.pricesIncludeTax,
    discount: quote.appliedDiscount
      ? {
          code: quote.appliedDiscount.code,
          type: quote.appliedDiscount.type,
          value: quote.appliedDiscount.value,
          discountId: quote.appliedDiscount.discountId,
        }
      : undefined,
    shippingAddress: input.shippingAddress,
    shippingMethod: {
      id: quote.selectedShippingMethod?.id || "standard",
      name: quote.selectedShippingMethod?.name || "Standard Shipping",
      amount: quote.shippingTotal,
    },
    taxLines: quote.taxLines,
    payment: {
      provider: provider.name as any,
      status: "pending",
      reference: initialReference,
      mode: credentials.mode,
    },
    reservation: {
      status: "held",
      expiresAt: reservationExpiresAt,
    },
    accessTokenHash,
    statusHistory: [
      {
        from: null,
        to: "pending_payment",
        at: new Date(),
        actor: "customer",
        reason: "Checkout initiated",
      },
    ],
    notes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const paymentDoc: PaymentDoc = {
    _id: paymentId,
    tenantId: input.tenantId,
    orderId,
    provider: provider.name as any,
    mode: credentials.mode,
    reference: initialReference,
    amount: quote.total,
    currency: quote.currency,
    status: "pending",
    refundedAmount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await withTransaction(async (session) => {
    // Reserve inventory
    const reservationItems = quote.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));
    await reserveInventory(
      session,
      input.tenantId,
      reservationItems,
      settings?.inventory?.allowBackorders ?? false,
      orderId,
    );

    // If discount was applied, increment usage count conditionally
    if (quote.appliedDiscount) {
      await db.discounts.updateOne(
        { _id: quote.appliedDiscount.discountId },
        { $inc: { usageCount: 1 } },
        { session },
      );
    }

    // Insert order & payment
    const rawOrders = await rawTenantCollection("orders");
    const rawPayments = await rawTenantCollection("payments");
    await rawOrders.insertOne(orderDoc, { session });
    await rawPayments.insertOne(paymentDoc, { session });
  });

  // 5. Initialize payment with the provider
  let checkoutUrl: string | undefined;
  try {
    const returnUrlWithToken = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}token=${accessToken}`;
    const initRes = await provider.initialize(credentials, {
      tenantId: input.tenantId.toHexString(),
      orderId: orderId.toHexString(),
      orderNumber,
      amount: quote.total,
      currency: quote.currency,
      customerEmail: input.customerEmail,
      returnUrl: returnUrlWithToken,
      cancelUrl: input.cancelUrl,
      metadata: { orderId: orderId.toHexString() },
    });

    checkoutUrl = initRes.checkoutUrl;

    if (initRes.reference !== initialReference) {
      // Update reference if provider generated its own
      await db.orders.updateOne(
        { _id: orderId },
        { $set: { "payment.reference": initRes.reference } },
      );
      await db.payments.updateOne(
        { _id: paymentId },
        { $set: { reference: initRes.reference, checkoutUrl: initRes.checkoutUrl } },
      );
      orderDoc.payment.reference = initRes.reference;
      paymentDoc.reference = initRes.reference;
    }
  } catch (err) {
    // Log and leave order in pending_payment so user can retry payment
    console.error("Payment initialization warning:", err);
  }

  await recordAudit({
    tenantId: input.tenantId,
    category: "commerce",
    action: "order.created",
    outcome: "success",
    actor: {
      type: input.customerId ? "customer" : "anonymous",
      id: input.customerId?.toHexString(),
      email: input.customerEmail,
    },
    target: { type: "order", id: orderId.toHexString() },
    metadata: { orderNumber, total: quote.total, currency: quote.currency },
    ip: input.ip,
  });

  return {
    order: orderDoc,
    payment: paymentDoc,
    checkoutUrl,
    accessToken,
  };
}

export async function confirmOrderPayment(params: {
  tenantId: ObjectId;
  reference: string;
}): Promise<{ success: boolean; orderId: ObjectId; alreadyPaid: boolean }> {
  const db = await tenantDb(params.tenantId);

  // 1. Locate the payment record
  const payment = await db.payments.findOne({ reference: params.reference });
  if (!payment) {
    throw Errors.notFound("Payment transaction not found for reference");
  }

  const order = await db.orders.findOne({ _id: payment.orderId });
  if (!order) {
    throw Errors.notFound("Order not found");
  }

  // Idempotency: if already paid, return early safely
  if (order.status === "paid" || order.status === "processing" || order.status === "shipped") {
    return { success: true, orderId: order._id, alreadyPaid: true };
  }

  // 2. Authoritative server verification with the provider
  const { provider, credentials } = await getTenantPaymentCredentials(params.tenantId);
  const verifyRes = await provider.verify(credentials, params.reference);

  if (!verifyRes.verified || verifyRes.status !== "succeeded") {
    await db.payments.updateOne(
      { _id: payment._id },
      { $set: { status: "failed", updatedAt: new Date() } },
    );
    throw Errors.payment("Payment could not be verified by the payment provider");
  }

  // 3. Strict amount and currency verification
  if (
    payment.provider !== "mock" &&
    (verifyRes.amount !== payment.amount || verifyRes.currency !== payment.currency)
  ) {
    await db.orders.updateOne(
      { _id: order._id },
      { $set: { paymentIssue: "amount_mismatch", updatedAt: new Date() } },
    );
    throw Errors.payment("Payment amount or currency mismatch");
  }

  // 4. Atomic transition to paid + inventory commit
  const now = new Date();
  await withTransaction(async (session) => {
    const rawOrders = await rawTenantCollection("orders");
    const rawPayments = await rawTenantCollection("payments");

    await rawPayments.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "succeeded",
          providerTransactionId: verifyRes.providerTransactionId,
          verifiedAt: now,
          updatedAt: now,
        },
      },
      { session },
    );

    await rawOrders.updateOne(
      { _id: order._id, status: "pending_payment" },
      {
        $set: {
          status: "paid",
          paidAt: now,
          "payment.status": "succeeded",
          "reservation.status": "committed",
          updatedAt: now,
        },
        $push: {
          statusHistory: {
            from: "pending_payment",
            to: "paid",
            at: now,
            actor: "payment_webhook",
            reason: `Payment verified via ${payment.provider}`,
          },
        } as any,
      },
      { session },
    );

    // Commit inventory (reduces onHand and reserved)
    const commitItems = order.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: i.quantity,
    }));
    await commitInventory(session, params.tenantId, commitItems, order._id);

    // If customer was linked, update total spent
    if (order.customerId) {
      const rawCustomers = await rawTenantCollection("customers");
      await rawCustomers.updateOne(
        { _id: order.customerId },
        {
          $inc: { ordersCount: 1, totalSpent: order.total },
          $set: { updatedAt: now },
        },
        { session },
      );
    }
  });

  // 5. Send confirmation email asynchronously
  sendEmail({
    to: order.email,
    subject: `Order Confirmation #${order.orderNumber}`,
    text: `Thank you for your order! Your payment of ${formatMoney(order.total, order.currency)} has been received. Order #${order.orderNumber} is now being processed.`,
  }).catch((err) => console.error("Email send failed:", err));

  // 6. Record audit log
  await recordAudit({
    tenantId: params.tenantId,
    category: "commerce",
    action: "order.paid",
    outcome: "success",
    actor: { type: "system", id: "payment_verifier" },
    target: { type: "order", id: order._id.toHexString() },
    metadata: { reference: params.reference, orderNumber: order.orderNumber, total: order.total },
  });

  return { success: true, orderId: order._id, alreadyPaid: false };
}
