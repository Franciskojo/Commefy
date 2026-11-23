import { NextRequest, NextResponse } from "next/server";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { getPaymentProvider } from "@/lib/payments/factory";
import { confirmOrderPayment } from "@/features/checkout/service";
import { sha256Hex, decryptSecret } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    const provider = getPaymentProvider("stripe");
    const event = provider.parseWebhookEvent(rawBody);
    if (!event) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // 1. Idempotency check
    const webhooksCol = await platformCollection("webhookEvents");
    const existing = await webhooksCol.findOne({
      provider: "stripe",
      eventId: event.eventId,
    });

    if (existing && existing.status === "processed") {
      return NextResponse.json({ received: true, idempotent: true });
    }

    // 2. Locate tenant from the checkout reference or payment intent
    const rawPayments = await rawTenantCollection("payments");
    const payment = await rawPayments.findOne({
      $or: [{ reference: event.reference }, { providerTransactionId: event.reference }],
    });

    if (!payment) {
      logger.warn("Stripe webhook reference not matched", { reference: event.reference });
      return NextResponse.json({ error: "Payment reference not found" }, { status: 404 });
    }

    // 3. Verify signature using tenant's webhook secret
    const rawConfigs = await rawTenantCollection("paymentConfigs");
    const config = await rawConfigs.findOne({ tenantId: payment.tenantId });
    if (!config?.webhookSecretEnc) {
      return NextResponse.json({ error: "Tenant Stripe webhook secret not configured" }, { status: 400 });
    }

    const secretAad = `tenant:${payment.tenantId.toHexString()}:webhookSecret`;
    const webhookSecret = decryptSecret(config.webhookSecretEnc, secretAad);

    const isValid = provider.verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      logger.warn("Invalid Stripe signature or expired timestamp rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Record event as processing
    await webhooksCol.updateOne(
      { provider: "stripe", eventId: event.eventId },
      {
        $setOnInsert: {
          scope: "store",
          tenantId: payment.tenantId,
          type: event.type,
          status: "processing",
          attempts: 1,
          payloadDigest: sha256Hex(rawBody),
          receivedAt: new Date(),
        },
      },
      { upsert: true },
    );

    // 4. Process event
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      await confirmOrderPayment({
        tenantId: payment.tenantId,
        reference: payment.reference,
      });
    }

    // Mark event processed
    await webhooksCol.updateOne(
      { provider: "stripe", eventId: event.eventId },
      { $set: { status: "processed", processedAt: new Date() } },
    );

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error("Stripe webhook processing error", { err: err?.message });
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
