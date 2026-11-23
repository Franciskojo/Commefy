"use server";

import { loginCustomer } from "@/features/customers/service";
import { reconcileCartOnLogin } from "@/features/cart/service";
import { platformCollection } from "@/lib/db/collections";
import { toPublicError } from "@/lib/errors";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function customerLoginAction(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  const slug = (formData.get("slug") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const returnTo = (formData.get("returnTo") as string)?.trim();

  if (!slug || !email || !password) {
    return { error: "Email and password are required" };
  }

  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug, status: "active" });
  if (!tenant) {
    return { error: "Store not found or unavailable" };
  }

  try {
    const { customer } = await loginCustomer({
      tenantId: tenant._id,
      email,
      password,
    });

    // Check if there is an anonymous cart cookie to reconcile
    const cookieStore = await cookies();
    const cartCookie = cookieStore.get(`sf_cart_${tenant._id.toHexString()}`)?.value;
    if (cartCookie) {
      await reconcileCartOnLogin({
        tenantId: tenant._id,
        anonymousCartToken: cartCookie,
        customerId: customer._id,
      });
    }
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }

  redirect(returnTo && returnTo.startsWith(`/store/${slug}`) ? returnTo : `/store/${slug}/account`);
}
