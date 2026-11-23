import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/factory";
import { confirmOrderPayment } from "@/features/checkout/service";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { getEnv } from "@/lib/env";
import { sha256Hex } from "@/lib/security/crypto";

export async function POST(req: NextRequest) {
  const env = getEnv();
  if (!env.allowMockPayments) {
    return NextResponse.json({ error: "Mock payments disabled in this environment" }, { status: 403 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-mock-signature") || "";

    const provider = getPaymentProvider("mock");
    const secret = env.MOCK_PAYMENT_SECRET || "mock-secret-key-32-chars-long!";

    if (!provider.verifyWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = provider.parseWebhookEvent(rawBody);
    if (!event) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const rawPayments = await rawTenantCollection("payments");
    const payment = await rawPayments.findOne({ reference: event.reference });
    if (!payment) return NextResponse.json({ error: "Reference not found" }, { status: 404 });

    const webhooksCol = await platformCollection("webhookEvents");
    const existing = await webhooksCol.findOne({ provider: "mock", eventId: event.eventId });
    if (existing && existing.status === "processed") {
      return NextResponse.json({ received: true, idempotent: true });
    }

    await confirmOrderPayment({
      tenantId: payment.tenantId,
      reference: payment.reference,
    });

    await webhooksCol.updateOne(
      { provider: "mock", eventId: event.eventId },
      {
        $set: {
          scope: "store",
          tenantId: payment.tenantId,
          type: event.type,
          status: "processed",
          payloadDigest: sha256Hex(rawBody),
          processedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
