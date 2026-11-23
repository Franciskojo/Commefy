import React from "react";
import { notFound } from "next/navigation";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { getProductBySlug } from "@/features/products/service";
import { tenantDb } from "@/lib/db/scoped";
import { ProductDetailClient } from "@/components/storefront/ProductDetailClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  try {
    const tenant = await resolveStorefrontTenant(slug);
    const product = await getProductBySlug(tenant._id, productSlug);
    if (!product) return { title: "Product Not Found" };

    return {
      title: product.seo?.title || `${product.name} | ${tenant.name}`,
      description: product.seo?.description || product.description.slice(0, 160),
      openGraph: {
        title: product.name,
        description: product.description.slice(0, 160),
        images: product.images?.[0]?.url ? [product.images[0].url] : [],
      },
    };
  } catch {
    return { title: "StoreForge" };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const product = await getProductBySlug(tenant._id, productSlug);
  if (!product || product.status !== "active") {
    notFound();
  }

  // Fetch real-time available inventory for all variants
  const variantIds = product.variants.map((v) => v._id);
  const inventoryItems = await db.inventory.find({ variantId: { $in: variantIds } }).toArray();
  const inventoryMap = new Map(
    inventoryItems.map((inv) => [inv.variantId.toHexString(), Math.max(0, inv.onHand - inv.reserved)]),
  );

  const currency = settings?.currency || "USD";
  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";

  const enrichedProduct = {
    _id: product._id.toHexString(),
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    images: product.images,
    variants: product.variants.map((v) => ({
      _id: v._id.toHexString(),
      sku: v.sku,
      title: v.title,
      options: v.options,
      price: v.price,
      salePrice: v.salePrice,
      stockAvailable: inventoryMap.get(v._id.toHexString()) ?? 0,
    })),
  };

  // Schema.org JSON-LD structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: currency,
      lowPrice: (product.priceMin / 100).toFixed(2),
      offerCount: product.variants.length,
      availability:
        enrichedProduct.variants.some((v) => v.stockAvailable > 0)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient
        storeSlug={slug}
        currency={currency}
        primaryColor={primaryColor}
        product={enrichedProduct}
      />
    </div>
  );
}
