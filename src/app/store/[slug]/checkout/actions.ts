"use server";

import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { createCheckoutOrder } from "@/features/checkout/service";
import { parseObjectId } from "@/lib/ids";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { computeQuote } from "@/features/checkout/pricing";
import { toPublicError } from "@/lib/errors";

export async function getQuoteAction(params: {
  storeSlug: string;
  items: { productId: string; variantId: string; quantity: number }[];
  discountCode?: string;
  country?: string;
  shippingMethodId?: string;
}) {
  try {
    const tenant = await resolveStorefrontTenant(params.storeSlug);
    const parsedItems = params.items.map((i) => ({
      productId: parseObjectId(i.productId),
      variantId: parseObjectId(i.variantId),
      quantity: i.quantity,
    }));

    const quote = await computeQuote({
      tenantId: tenant._id,
      items: parsedItems,
      discountCode: params.discountCode,
      shippingAddress: params.country
        ? {
            name: "Quote",
            line1: "Quote",
            city: "Quote",
            country: params.country,
          }
        : undefined,
      shippingMethodId: params.shippingMethodId,
    });

    return { success: true, quote };
  } catch (err) {
    const pub = toPublicError(err);
    return { success: false, error: pub.body.message };
  }
}

export async function submitCheckoutAction(params: {
  storeSlug: string;
  email: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  phone?: string;
  shippingMethodId: string;
  discountCode?: string;
  items: { productId: string; variantId: string; quantity: number }[];
}): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
  try {
    const tenant = await resolveStorefrontTenant(params.storeSlug);
    const headerList = await headers();
    const host = headerList.get("host") || "localhost:3000";
    const proto = host.includes("localhost") ? "http" : "https";

    const parsedItems = params.items.map((i) => ({
      productId: parseObjectId(i.productId),
      variantId: parseObjectId(i.variantId),
      quantity: i.quantity,
    }));

    const returnUrl = `${proto}://${host}/store/${params.storeSlug}/orders/confirm`;

    const { order, checkoutUrl, accessToken } = await createCheckoutOrder({
      tenantId: tenant._id,
      customerEmail: params.email,
      items: parsedItems,
      discountCode: params.discountCode,
      shippingMethodId: params.shippingMethodId,
      shippingAddress: {
        name: params.name,
        line1: params.line1,
        line2: params.line2,
        city: params.city,
        region: params.region,
        postalCode: params.postalCode,
        country: params.country.toUpperCase(),
        phone: params.phone,
      },
      returnUrl,
      cancelUrl: `${proto}://${host}/store/${params.storeSlug}/checkout`,
    });

    const targetUrl = checkoutUrl
      ? checkoutUrl
      : `/store/${params.storeSlug}/orders/${order._id.toHexString()}?token=${accessToken}`;

    return { success: true, redirectUrl: targetUrl };
  } catch (err) {
    const pub = toPublicError(err);
    return { success: false, error: pub.body.message };
  }
}
