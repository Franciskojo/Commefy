import "server-only";
import type { CurrencyCode } from "@/lib/money";
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
import { hmacHex, safeEqual, sha256Hex } from "@/lib/security/crypto";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async initialize(
    credentials: PaymentCredentials,
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const reference = `mock_ref_${Date.now()}_${input.orderNumber}_${input.amount}_${input.currency}`;
    // Construct local mock checkout URL
    const checkoutUrl = `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}reference=${reference}&mock=true`;

    return {
      reference,
      checkoutUrl,
      providerTransactionId: `mock_tx_${Date.now()}`,
      mode: "test",
    };
  }

  async verify(credentials: PaymentCredentials, reference: string): Promise<VerifyPaymentResult> {
    // If reference starts with mock_fail, simulate failure
    if (reference.includes("fail")) {
      return {
        verified: false,
        status: "failed",
        reference,
        amount: 0,
        currency: "USD",
      };
    }

    const parts = reference.split("_");
    const parsedCurrency = (parts.length >= 6 ? parts[parts.length - 1] : "USD") as CurrencyCode;
    const parsedAmount = parts.length >= 6 ? Number(parts[parts.length - 2]) : 1000;

    return {
      verified: true,
      status: "succeeded",
      reference,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 1000,
      currency: parsedCurrency,
      providerTransactionId: `mock_tx_${sha256Hex(reference).slice(0, 16)}`,
    };
  }

  async refund(credentials: PaymentCredentials, input: CreateRefundInput): Promise<CreateRefundResult> {
    return {
      success: true,
      status: "succeeded",
      providerRefundId: `mock_rf_${Date.now()}`,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
    const expected = hmacHex("sha256", webhookSecret, rawBody);
    return safeEqual(expected, signature);
  }

  parseWebhookEvent(rawBody: string): WebhookEventResult | null {
    try {
      const data = JSON.parse(rawBody);
      return {
        eventId: data.id || `mock_evt_${Date.now()}`,
        type: data.event || "payment.success",
        reference: data.data?.reference || data.reference,
        amount: data.data?.amount || data.amount,
        currency: data.data?.currency || data.currency,
        status: data.data?.status === "failed" ? "failed" : "succeeded",
        raw: data,
      };
    } catch {
      return null;
    }
  }
}
