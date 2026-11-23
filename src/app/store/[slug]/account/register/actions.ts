"use server";

import { registerCustomer } from "@/features/customers/service";
import { reconcileCartOnLogin } from "@/features/cart/service";
import { platformCollection } from "@/lib/db/collections";
import { toPublicError } from "@/lib/errors";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function customerRegisterAction(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  const slug = (formData.get("slug") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const marketingOptIn = formData.get("marketingOptIn") === "true";

  if (!slug || !name || !email || !password) {
    return { error: "All required fields must be completed" };
  }

  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug, status: "active" });
  if (!tenant) {
    return { error: "Store not found or unavailable" };
  }

  try {
    const { customer } = await registerCustomer({
      tenantId: tenant._id,
      name,
      email,
      password,
      marketingOptIn,
    });

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

  redirect(`/store/${slug}/account`);
}
