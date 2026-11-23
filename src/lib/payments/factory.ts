import "server-only";
import { type ObjectId } from "mongodb";
import { rawTenantCollection } from "@/lib/db/collections";
import type { PaymentProviderName } from "@/lib/db/types";
import type { PaymentCredentials, PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock";
import { PaystackPaymentProvider } from "./paystack";
import { StripePaymentProvider } from "./stripe";
import { decryptSecret } from "@/lib/security/crypto";
import { getEnv } from "@/lib/env";
import { Errors } from "@/lib/errors";

const providers: Record<PaymentProviderName, PaymentProvider> = {
  mock: new MockPaymentProvider(),
  paystack: new PaystackPaymentProvider(),
  stripe: new StripePaymentProvider(),
};

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  const provider = providers[name];
  if (!provider) {
    throw Errors.payment(`Unsupported payment provider: ${name}`);
  }
  return provider;
}

export async function getTenantPaymentCredentials(
  tenantId: ObjectId,
): Promise<{ provider: PaymentProvider; credentials: PaymentCredentials }> {
  const env = getEnv();
  const col = await rawTenantCollection("paymentConfigs");
  const config = await col.findOne({ tenantId });

  if (!config || !config.secretKeyEnc) {
    if (env.allowMockPayments) {
      return {
        provider: providers.mock,
        credentials: {
          secretKey: env.MOCK_PAYMENT_SECRET || "mock-secret-key-32-chars-long!",
          mode: "test",
        },
      };
    }
    throw Errors.payment("Store payments are not configured. Please contact the store owner.");
  }

  const aad = `tenant:${tenantId.toHexString()}:secretKey`;
  const secretKey = decryptSecret(config.secretKeyEnc, aad);

  let webhookSecret: string | undefined;
  if (config.webhookSecretEnc) {
    const webhookAad = `tenant:${tenantId.toHexString()}:webhookSecret`;
    webhookSecret = decryptSecret(config.webhookSecretEnc, webhookAad);
  }

  const provider = getPaymentProvider(config.provider);
  return {
    provider,
    credentials: {
      publicKey: config.publicKey,
      secretKey,
      webhookSecret,
      mode: config.mode,
    },
  };
}
