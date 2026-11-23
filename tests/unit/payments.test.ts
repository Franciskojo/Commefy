import { describe, it, expect, beforeAll } from "vitest";
import { MockPaymentProvider } from "@/lib/payments/mock";
import { PaystackPaymentProvider } from "@/lib/payments/paystack";
import { StripePaymentProvider } from "@/lib/payments/stripe";
import { hmacHex } from "@/lib/security/crypto";
import { resetEnvCache } from "@/lib/env";

describe("Payment Providers and Webhook Signature Verification", () => {
  beforeAll(() => {
    process.env.APP_URL = "http://localhost:3000";
    process.env.PLATFORM_ROOT_DOMAIN = "storeforge.test";
    process.env.MONGODB_URI = "mongodb://localhost:27017/storeforge_test";
    process.env.AUTH_SECRET = "super-secret-auth-key-at-least-32-chars-long";
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    resetEnvCache();
  });

  it("verifies Mock provider webhook signature", () => {
    const mock = new MockPaymentProvider();
    const secret = "test_webhook_secret";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "ref_1" } });
    const sig = hmacHex("sha256", secret, body);

    expect(mock.verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(mock.verifyWebhookSignature(body, "wrong_sig", secret)).toBe(false);
  });

  it("verifies Paystack HMAC-SHA512 webhook signature", () => {
    const pstk = new PaystackPaymentProvider();
    const secret = "paystack_secret_key";
    const body = JSON.stringify({ event: "charge.success", data: { reference: "pstk_ref" } });
    const sig = hmacHex("sha512", secret, body);

    expect(pstk.verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(pstk.verifyWebhookSignature(body, "wrong_sig", secret)).toBe(false);
  });

  it("verifies Stripe timestamped HMAC-SHA256 signature with replay tolerance", () => {
    const stripe = new StripePaymentProvider();
    const secret = "whsec_stripe_test_secret";
    const body = JSON.stringify({ type: "checkout.session.completed", id: "evt_123" });
    const nowSec = Math.floor(Date.now() / 1000);

    const payload = `${nowSec}.${body}`;
    const sig = hmacHex("sha256", secret, payload);
    const header = `t=${nowSec},v1=${sig}`;

    expect(stripe.verifyWebhookSignature(body, header, secret)).toBe(true);

    // Tampered payload fails
    expect(stripe.verifyWebhookSignature('{"tampered":true}', header, secret)).toBe(false);

    // Expired timestamp (older than 5 minutes) fails replay check
    const oldSec = nowSec - 400;
    const oldPayload = `${oldSec}.${body}`;
    const oldSig = hmacHex("sha256", secret, oldPayload);
    const oldHeader = `t=${oldSec},v1=${oldSig}`;
    expect(stripe.verifyWebhookSignature(body, oldHeader, secret)).toBe(false);
  });
});
