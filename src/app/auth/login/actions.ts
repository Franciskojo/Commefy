"use server";

import { loginUser } from "@/features/staff/service";
import { rawTenantCollection, platformCollection } from "@/lib/db/collections";
import { toPublicError } from "@/lib/errors";
import { redirect } from "next/navigation";

export async function loginAction(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  let redirectUrl: string;

  try {
    const result = await loginUser({ email, password });

    if (result.mfaRequired) {
      redirectUrl = "/auth/mfa";
    } else if (result.user.platformRole) {
      redirectUrl = "/platform";
    } else {
      const membershipsCol = await rawTenantCollection("memberships");
      const membership = await membershipsCol.findOne({
        userId: result.user._id,
        status: "active",
      });

      if (membership) {
        const tenantsCol = await platformCollection("tenants");
        const tenant = await tenantsCol.findOne({ _id: membership.tenantId });
        if (tenant) {
          redirectUrl = `/admin/${tenant.slug}`;
        } else {
          redirectUrl = "/auth/register";
        }
      } else {
        redirectUrl = "/auth/register";
      }
    }
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }

  redirect(redirectUrl);
}
