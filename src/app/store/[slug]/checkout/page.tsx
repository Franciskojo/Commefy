import React from "react";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { CheckoutClient } from "./CheckoutClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  robots: "noindex, nofollow",
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const currency = settings?.currency || "USD";
  const shippingZones = settings?.shipping?.zones || [];

  return (
    <CheckoutClient
      storeSlug={slug}
      currency={currency}
      shippingZones={shippingZones}
    />
  );
}
