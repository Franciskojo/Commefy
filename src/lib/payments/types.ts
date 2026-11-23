import type { CurrencyCode } from "@/lib/money";

export interface InitializePaymentInput {
  tenantId: string;
  orderId: string;
  orderNumber: number;
  amount: number; // minor units
  currency: CurrencyCode;
  customerEmail: string;
  returnUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  reference: string;
  checkoutUrl?: string;
  providerTransactionId?: string;
  mode: "test" | "live";
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: "succeeded" | "failed" | "pending";
  reference: string;
  amount: number; // minor units
  currency: CurrencyCode;
  providerTransactionId?: string;
  raw?: Record<string, unknown>;
}

export interface CreateRefundInput {
  paymentReference: string;
  amount: number; // minor units
  currency: CurrencyCode;
  reason?: string;
  idempotencyKey: string;
}

export interface CreateRefundResult {
  success: boolean;
  providerRefundId?: string;
  status: "succeeded" | "pending" | "failed";
  raw?: Record<string, unknown>;
}

export interface WebhookEventResult {
  eventId: string;
  type: string;
  reference: string;
  amount?: number;
  currency?: CurrencyCode;
  status: "succeeded" | "failed";
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;

  initialize(credentials: PaymentCredentials, input: InitializePaymentInput): Promise<InitializePaymentResult>;

  verify(credentials: PaymentCredentials, reference: string): Promise<VerifyPaymentResult>;

  refund(credentials: PaymentCredentials, input: CreateRefundInput): Promise<CreateRefundResult>;

  verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean;

  parseWebhookEvent(rawBody: string): WebhookEventResult | null;
}

export interface PaymentCredentials {
  publicKey?: string;
  secretKey: string;
  webhookSecret?: string;
  mode: "test" | "live";
}
