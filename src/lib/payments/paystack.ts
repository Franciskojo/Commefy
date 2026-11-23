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

const BASE_URL = "https://api.paystack.co";

export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = "paystack";

  async initialize(
    credentials: PaymentCredentials,
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const reference = `pstk_${input.orderId}_${Date.now()}`;

    const res = await fetch(`${BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference,
        amount: input.amount, // Paystack amounts are in minor units (kobo/cents)
        currency: input.currency,
        email: input.customerEmail,
        callback_url: input.returnUrl,
        metadata: {
          tenantId: input.tenantId,
          orderId: input.orderId,
          orderNumber: input.orderNumber,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw Errors.payment(`Paystack initialization failed: ${err}`);
    }

    const json = await res.json();
    return {
      reference,
      checkoutUrl: json.data?.authorization_url,
      providerTransactionId: json.data?.access_code,
      mode: credentials.mode,
    };
  }

  async verify(credentials: PaymentCredentials, reference: string): Promise<VerifyPaymentResult> {
    const res = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
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
    const data = json.data;
    const isSuccess = data?.status === "success";

    return {
      verified: isSuccess,
      status: isSuccess ? "succeeded" : data?.status === "abandoned" ? "failed" : "pending",
      reference: data?.reference || reference,
      amount: data?.amount,
      currency: data?.currency,
      providerTransactionId: data?.id ? String(data.id) : undefined,
      raw: data,
    };
  }

  async refund(credentials: PaymentCredentials, input: CreateRefundInput): Promise<CreateRefundResult> {
    const res = await fetch(`${BASE_URL}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: input.paymentReference,
        amount: input.amount,
        merchant_note: input.reason,
      }),
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
      success: true,
      status: json.data?.status === "processed" ? "succeeded" : "pending",
      providerRefundId: json.data?.id ? String(json.data.id) : undefined,
      raw: json.data,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
    const expected = hmacHex("sha512", webhookSecret, rawBody);
    return safeEqual(expected, signature);
  }

  parseWebhookEvent(rawBody: string): WebhookEventResult | null {
    try {
      const data = JSON.parse(rawBody);
      const isSuccess = data.event === "charge.success";
      return {
        eventId: data.data?.id ? String(data.data.id) : `pstk_evt_${Date.now()}`,
        type: data.event,
        reference: data.data?.reference,
        amount: data.data?.amount,
        currency: data.data?.currency,
        status: isSuccess ? "succeeded" : "failed",
        raw: data,
      };
    } catch {
      return null;
    }
  }
}
