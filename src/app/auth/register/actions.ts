"use server";

import { registerTenant } from "@/features/tenants/service";
import { toPublicError } from "@/lib/errors";
import { redirect } from "next/navigation";
import type { CurrencyCode } from "@/lib/money";

export async function registerAction(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  const storeName = (formData.get("storeName") as string)?.trim();
  const desiredSlug = (formData.get("desiredSlug") as string)?.trim() || undefined;
  const ownerName = (formData.get("ownerName") as string)?.trim();
  const ownerEmail = (formData.get("ownerEmail") as string)?.trim();
  const password = formData.get("password") as string;
  const currency = (formData.get("currency") as CurrencyCode) || "USD";

  if (!storeName || !ownerName || !ownerEmail || !password) {
    return { error: "All required fields must be completed" };
  }

  let redirectUrl: string;

  try {
    const result = await registerTenant({
      storeName,
      desiredSlug,
      ownerName,
      ownerEmail,
      password,
      currency,
    });

    redirectUrl = `/admin/${result.tenant.slug}`;
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }

  redirect(redirectUrl);
}
