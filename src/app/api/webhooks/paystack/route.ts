import { NextRequest, NextResponse } from "next/server";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { getPaymentProvider } from "@/lib/payments/factory";
import { confirmOrderPayment } from "@/features/checkout/service";
import { sha256Hex } from "@/lib/security/crypto";
import { decryptSecret } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    const provider = getPaymentProvider("paystack");
    const event = provider.parseWebhookEvent(rawBody);
    if (!event) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    // 1. Check idempotency in webhookEvents
    const webhooksCol = await platformCollection("webhookEvents");
    const existing = await webhooksCol.findOne({
      provider: "paystack",
      eventId: event.eventId,
    });

    if (existing && existing.status === "processed") {
      // Idempotent: return 200 immediately
      return NextResponse.json({ received: true, idempotent: true });
    }

    // 2. Locate tenant from the transaction reference
    const rawPayments = await rawTenantCollection("payments");
    const payment = await rawPayments.findOne({ reference: event.reference });
    if (!payment) {
      logger.warn("Webhook reference not found", { reference: event.reference });
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    // 3. Verify webhook signature against tenant's configured webhook secret
    const rawConfigs = await rawTenantCollection("paymentConfigs");
    const config = await rawConfigs.findOne({ tenantId: payment.tenantId });
    if (!config?.webhookSecretEnc && !config?.secretKeyEnc) {
      return NextResponse.json({ error: "Tenant webhook secret not configured" }, { status: 400 });
    }

    const secretAad = config.webhookSecretEnc
      ? `tenant:${payment.tenantId.toHexString()}:webhookSecret`
      : `tenant:${payment.tenantId.toHexString()}:secretKey`;
    const secretKey = decryptSecret(config.webhookSecretEnc || config.secretKeyEnc!, secretAad);

    const isValid = provider.verifyWebhookSignature(rawBody, signature, secretKey);
    if (!isValid) {
      logger.warn("Invalid Paystack webhook signature rejected", { reference: event.reference });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Record event as processing
    await webhooksCol.updateOne(
      { provider: "paystack", eventId: event.eventId },
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

    // 4. Handle event type
    if (event.type === "charge.success") {
      await confirmOrderPayment({
        tenantId: payment.tenantId,
        reference: event.reference,
      });
    }

    // Mark as processed
    await webhooksCol.updateOne(
      { provider: "paystack", eventId: event.eventId },
      { $set: { status: "processed", processedAt: new Date() } },
    );

    return NextResponse.json({ received: true });
  } catch (err: any) {
    logger.error("Paystack webhook processing error", { err: err?.message });
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
