import "server-only";
import type {
  PaymentProvider,
  PaymentCredentials,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentResult,
  CreateRefundInput,
  CreateRefundResult,
  WebhookEventResult,
} from "./types";
import { hmacHex, safeEqual } from "@/lib/security/crypto";
import { Errors } from "@/lib/errors";

const BASE_URL = "https://api.stripe.com/v1";

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  async initialize(
    credentials: PaymentCredentials,
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const reference = `cs_${input.orderId}_${Date.now()}`;
    const returnUrlWithRef = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}reference=${reference}`;

    const params = new URLSearchParams();
    params.append("client_reference_id", reference);
    params.append("mode", "payment");
    params.append("customer_email", input.customerEmail);
    params.append("success_url", returnUrlWithRef);
    if (input.cancelUrl) params.append("cancel_url", input.cancelUrl);

    params.append("line_items[0][price_data][currency]", input.currency.toLowerCase());
    params.append("line_items[0][price_data][unit_amount]", String(input.amount));
    params.append(
      "line_items[0][price_data][product_data][name]",
      `Order #${input.orderNumber}`,
    );
    params.append("line_items[0][quantity]", "1");

    params.append("metadata[tenantId]", input.tenantId);
    params.append("metadata[orderId]", input.orderId);
    params.append("metadata[reference]", reference);

    const res = await fetch(`${BASE_URL}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw Errors.payment(`Stripe checkout initialization failed: ${err}`);
    }

    const json = await res.json();
    return {
      reference,
      checkoutUrl: json.url,
      providerTransactionId: json.id,
      mode: credentials.mode,
    };
  }

  async verify(credentials: PaymentCredentials, reference: string): Promise<VerifyPaymentResult> {
    // Search sessions or retrieve by session id if reference is session id
    const isSessionId = reference.startsWith("cs_");
    const endpoint = isSessionId
      ? `${BASE_URL}/checkout/sessions/${encodeURIComponent(reference)}`
      : `${BASE_URL}/checkout/sessions?client_reference_id=${encodeURIComponent(reference)}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
      },
    });

    if (!res.ok) {
      return {
        verified: false,
        status: "failed",
        reference,
        amount: 0,
        currency: "USD",
      };
    }

    const json = await res.json();
    const session = isSessionId ? json : json.data?.[0];
    if (!session) {
      return {
        verified: false,
        status: "failed",
        reference,
        amount: 0,
        currency: "USD",
      };
    }

    const isPaid = session.payment_status === "paid";
    return {
      verified: isPaid,
      status: isPaid ? "succeeded" : "pending",
      reference: session.client_reference_id || session.id,
      amount: session.amount_total,
      currency: session.currency?.toUpperCase(),
      providerTransactionId: session.payment_intent || session.id,
      raw: session,
    };
  }

  async refund(credentials: PaymentCredentials, input: CreateRefundInput): Promise<CreateRefundResult> {
    const params = new URLSearchParams();
    params.append("payment_intent", input.paymentReference);
    params.append("amount", String(input.amount));
    if (input.reason) params.append("reason", "requested_by_customer");

    const res = await fetch(`${BASE_URL}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        success: false,
        status: "failed",
        raw: { error: err },
      };
    }

    const json = await res.json();
    return {
      success: json.status === "succeeded",
      status: json.status === "succeeded" ? "succeeded" : "pending",
      providerRefundId: json.id,
      raw: json,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
    if (!signatureHeader || !webhookSecret) return false;

    // Parse stripe-signature header: t=1492774577,v1=5257a869e7ecebeda32affa...
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";

    for (const part of parts) {
      const [k, v] = part.trim().split("=");
      if (k === "t") timestamp = v;
      if (k === "v1") signature = v;
    }

    if (!timestamp || !signature) return false;

    // Check 5-minute replay window tolerance
    const tsNum = parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (isNaN(tsNum) || Math.abs(nowSec - tsNum) > 300) {
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = hmacHex("sha256", webhookSecret, signedPayload);

    return safeEqual(expected, signature);
  }

  parseWebhookEvent(rawBody: string): WebhookEventResult | null {
    try {
      const event = JSON.parse(rawBody);
      const isSuccess =
        event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded";
      const obj = event.data?.object || {};

      return {
        eventId: event.id || `evt_${Date.now()}`,
        type: event.type,
        reference: obj.client_reference_id || obj.id || obj.payment_intent,
        amount: obj.amount_total || obj.amount,
        currency: obj.currency?.toUpperCase(),
        status: isSuccess ? "succeeded" : "failed",
        raw: event,
      };
    } catch {
      return null;
    }
  }
}
