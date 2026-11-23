"use server";

import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { requireTenantStaff } from "@/lib/auth/context";
import { encryptSecret } from "@/lib/security/crypto";
import { toPublicError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import type { PaymentProviderName } from "@/lib/db/types";

export async function savePaymentConfigAction(formData: FormData) {
  const tenantSlug = formData.get("tenantSlug") as string;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return { error: "Tenant not found" };

  try {
    // Only Store Owner can manage payment secrets
    const staff = await requireTenantStaff(tenant._id, "payment_keys:manage");

    const provider = formData.get("provider") as PaymentProviderName;
    const mode = (formData.get("mode") as "test" | "live") || "test";
    const publicKey = (formData.get("publicKey") as string)?.trim() || undefined;
    const secretKey = (formData.get("secretKey") as string)?.trim();
    const webhookSecret = (formData.get("webhookSecret") as string)?.trim();

    const rawConfigs = await rawTenantCollection("paymentConfigs");
    const existing = await rawConfigs.findOne({ tenantId: tenant._id });

    const updates: Record<string, unknown> = {
      provider,
      mode,
      publicKey,
      updatedBy: staff.user._id,
      updatedAt: new Date(),
    };

    // Encrypt secrets with tenant-bound AAD if provided
    if (secretKey) {
      const aad = `tenant:${tenant._id.toHexString()}:secretKey`;
      updates["secretKeyEnc"] = encryptSecret(secretKey, aad);
    }

    if (webhookSecret) {
      const webhookAad = `tenant:${tenant._id.toHexString()}:webhookSecret`;
      updates["webhookSecretEnc"] = encryptSecret(webhookSecret, webhookAad);
    }

    await rawConfigs.updateOne(
      { tenantId: tenant._id },
      {
        $set: updates,
        $setOnInsert: {
          _id: new (await import("mongodb")).ObjectId(),
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    revalidatePath(`/admin/${tenantSlug}/payments`);
    return { success: true };
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }
}
