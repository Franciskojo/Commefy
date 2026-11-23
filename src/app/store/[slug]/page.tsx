import React from "react";
import Link from "next/link";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { listProducts, listCategories } from "@/features/products/service";
import { tenantDb } from "@/lib/db/scoped";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ArrowRight, Sparkles, ShoppingBag, ShieldCheck } from "lucide-react";

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const currency = settings?.currency || "USD";
  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";

  // Fetch featured products and categories
  const [{ products: featuredProducts }, categories] = await Promise.all([
    listProducts({ tenantId: tenant._id, featured: true, limit: 8 }),
    listCategories(tenant._id),
  ]);

  // If no featured products, fetch latest
  const productsToShow =
    featuredProducts.length > 0
      ? featuredProducts
      : (await listProducts({ tenantId: tenant._id, limit: 8 })).products;

  return (
    <div className="space-y-20 pb-16">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-slate-900 text-white py-24 md:py-32">
        {/* Ambient Gradient Blobs */}
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: primaryColor }}
        />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-cyan-500 blur-3xl opacity-15 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              Welcome to our official store
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              {settings?.storeName || tenant.name}
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed">
              {settings?.tagline ||
                "Discover curated products crafted with exceptional materials and timeless quality."}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
              <Link
                href={`/store/${slug}/products`}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-bold text-base shadow-lg hover:brightness-110 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                Explore Collection
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href={`/store/${slug}/about`}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-base transition-colors"
              >
                Our Story
              </Link>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="relative w-full max-w-md aspect-4/3 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700/60 p-8 border border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mt-4">Handcrafted Excellence</h3>
              <p className="text-sm text-slate-300">
                Guaranteed satisfaction with every order, backed by our 14-day warranty.
              </p>
            </div>
            <div className="pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" /> 100% Verified Merchant
              </span>
              <span>Fast Tracked Dispatch</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1.5">
              Handpicked Selection
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Featured Products</h2>
          </div>
          <Link
            href={`/store/${slug}/products`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            View all products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {productsToShow.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No products published yet</h3>
            <p className="text-sm text-slate-500 mt-1">Check back soon for new arrivals!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsToShow.map((product) => (
              <ProductCard
                key={product._id.toHexString()}
                storeSlug={slug}
                currency={currency}
                product={{
                  _id: product._id.toHexString(),
                  name: product.name,
                  slug: product.slug,
                  brand: product.brand,
                  priceMin: product.priceMin,
                  featured: product.featured,
                  ratingAvg: product.ratingAvg,
                  ratingCount: product.ratingCount,
                  images: product.images,
                  variants: product.variants.map((v) => ({
                    _id: v._id.toHexString(),
                    title: v.title,
                    price: v.price,
                    salePrice: v.salePrice,
                  })),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Categories Showcase (if categories exist) */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1.5">
              Explore Collections
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat._id.toHexString()}
                href={`/store/${slug}/products?categoryId=${cat._id.toHexString()}`}
                className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-lg">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cat.description}</p>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-indigo-600">
                  Shop now &rarr;
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
