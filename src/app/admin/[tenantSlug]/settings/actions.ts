"use server";

import { platformCollection } from "@/lib/db/collections";
import { requireTenantStaff } from "@/lib/auth/context";
import { updateStoreBranding } from "@/features/tenants/service";
import { toPublicError } from "@/lib/errors";
import { revalidatePath } from "next/cache";

export async function updateSettingsAction(formData: FormData) {
  const tenantSlug = formData.get("tenantSlug") as string;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return { error: "Tenant not found" };

  try {
    const staff = await requireTenantStaff(tenant._id, "store:update");

    const storeName = formData.get("storeName") as string;
    const tagline = formData.get("tagline") as string;
    const primaryColor = formData.get("primaryColor") as string;
    const accentColor = formData.get("accentColor") as string;
    const logoUrl = formData.get("logoUrl") as string;

    const contactEmail = formData.get("contactEmail") as string | null;
    const contactPhone = formData.get("contactPhone") as string | null;
    const contactAddress = formData.get("contactAddress") as string | null;

    const policyAbout = formData.get("policyAbout") as string | null;
    const policyPrivacy = formData.get("policyPrivacy") as string | null;
    const policyTerms = formData.get("policyTerms") as string | null;
    const policyShipping = formData.get("policyShipping") as string | null;

    await updateStoreBranding({
      tenantId: tenant._id,
      actorUserId: staff.user._id,
      storeName,
      tagline,
      primaryColor,
      accentColor,
      logoUrl: logoUrl || undefined,
      contact: {
        email: contactEmail ?? undefined,
        phone: contactPhone ?? undefined,
        address: contactAddress ?? undefined,
      },
      policies: {
        about: policyAbout ?? undefined,
        privacy: policyPrivacy ?? undefined,
        terms: policyTerms ?? undefined,
        shippingReturns: policyShipping ?? undefined,
      },
    });

    revalidatePath(`/admin/${tenantSlug}/settings`);
    revalidatePath(`/store/${tenantSlug}`);
    revalidatePath(`/store/${tenantSlug}/about`);
    revalidatePath(`/store/${tenantSlug}/contact`);
    revalidatePath(`/store/${tenantSlug}/policies/privacy`);
    revalidatePath(`/store/${tenantSlug}/policies/terms`);
    revalidatePath(`/store/${tenantSlug}/policies/shipping-returns`);
    return { success: true };
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }
}
