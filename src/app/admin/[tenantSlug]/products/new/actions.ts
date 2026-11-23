"use server";

import { platformCollection } from "@/lib/db/collections";
import { requireTenantStaff } from "@/lib/auth/context";
import { createProduct } from "@/features/products/service";
import { parseMajorToMinor } from "@/lib/money";
import { toPublicError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProductAction(formData: FormData) {
  const tenantSlug = formData.get("tenantSlug") as string;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return { error: "Tenant not found" };

  try {
    const staff = await requireTenantStaff(tenant._id, "product:create");

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const brand = formData.get("brand") as string;
    const sku = (formData.get("sku") as string) || `SKU-${Date.now()}`;
    const priceStr = formData.get("price") as string;
    const salePriceStr = formData.get("salePrice") as string;
    const initialStockStr = formData.get("initialStock") as string;
    const imageUrl = formData.get("imageUrl") as string;

    const price = parseMajorToMinor(priceStr, "USD");
    const salePrice = salePriceStr ? parseMajorToMinor(salePriceStr, "USD") : undefined;
    const initialStock = parseInt(initialStockStr || "10", 10);

    await createProduct({
      tenantId: tenant._id,
      actorUserId: staff.user._id,
      name,
      description,
      brand,
      variants: [
        {
          sku,
          title: "Default Option",
          options: {},
          price,
          salePrice,
          initialStock,
        },
      ],
      images: imageUrl ? [{ url: imageUrl, alt: name }] : [],
    });

    revalidatePath(`/admin/${tenantSlug}/products`);
    revalidatePath(`/store/${tenantSlug}`);
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }

  redirect(`/admin/${tenantSlug}/products`);
}
