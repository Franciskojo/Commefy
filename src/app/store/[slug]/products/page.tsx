import React from "react";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { listProducts, listCategories } from "@/features/products/service";
import { tenantDb } from "@/lib/db/scoped";
import { ProductCard } from "@/components/storefront/ProductCard";
import { tryParseObjectId } from "@/lib/ids";
import Link from "next/link";
import { Search, ShoppingBag, X } from "lucide-react";

function buildQueryString(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [key, val] of Object.entries(merged)) {
    if (val !== undefined && val !== "") {
      params.set(key, val);
    }
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

export default async function ProductsCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    sort?: "price_asc" | "price_desc" | "newest" | "best_selling";
    page?: string;
  }>;
}) {
  const { slug } = await params;
  const sParams = await searchParams;

  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});
  const currency = settings?.currency || "USD";

  const categoryObjectId = tryParseObjectId(sParams.categoryId);
  const page = parseInt(sParams.page || "1", 10) || 1;

  const [{ products, total, totalPages }, categories] = await Promise.all([
    listProducts({
      tenantId: tenant._id,
      search: sParams.search,
      categoryId: categoryObjectId || undefined,
      sort: sParams.sort,
      page,
      limit: 12,
    }),
    listCategories(tenant._id),
  ]);

  const activeCategory = categories.find((c) => c._id.toHexString() === sParams.categoryId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Title & Filter Bar */}
      <div className="space-y-4 pb-6 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Products</h1>
            <p className="text-sm text-slate-500 mt-1">
              Showing {products.length} of {total} available items
            </p>
          </div>

          {/* Search & Sort controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search form */}
            <form method="GET" className="relative">
              {sParams.categoryId && <input type="hidden" name="categoryId" value={sParams.categoryId} />}
              {sParams.sort && <input type="hidden" name="sort" value={sParams.sort} />}
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={sParams.search || ""}
                placeholder="Search products..."
                className="pl-9 pr-4 py-2 text-sm bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
              />
            </form>

            {/* Sort options */}
            <div className="flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-lg p-1">
              <Link
                href={`/store/${slug}/products${buildQueryString(sParams, { sort: "newest", page: undefined })}`}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  !sParams.sort || sParams.sort === "newest"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Newest
              </Link>
              <Link
                href={`/store/${slug}/products${buildQueryString(sParams, { sort: "price_asc", page: undefined })}`}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  sParams.sort === "price_asc"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Price: Low
              </Link>
              <Link
                href={`/store/${slug}/products${buildQueryString(sParams, { sort: "price_desc", page: undefined })}`}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  sParams.sort === "price_desc"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Price: High
              </Link>
            </div>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(sParams.search || sParams.categoryId) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-600">
            <span className="font-medium">Active filters:</span>
            {sParams.search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                &ldquo;{sParams.search}&rdquo;
                <Link
                  href={`/store/${slug}/products${buildQueryString(sParams, { search: undefined, page: undefined })}`}
                  className="hover:text-indigo-900"
                >
                  <X className="w-3.5 h-3.5" />
                </Link>
              </span>
            )}
            {activeCategory && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                Category: {activeCategory.name}
                <Link
                  href={`/store/${slug}/products${buildQueryString(sParams, { categoryId: undefined, page: undefined })}`}
                  className="hover:text-indigo-900"
                >
                  <X className="w-3.5 h-3.5" />
                </Link>
              </span>
            )}
            <Link
              href={`/store/${slug}/products`}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline ml-2"
            >
              Reset all
            </Link>
          </div>
        )}

        {/* Mobile Horizontal Category Pills */}
        {categories.length > 0 && (
          <div className="flex lg:hidden items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
            <Link
              href={`/store/${slug}/products${buildQueryString(sParams, { categoryId: undefined, page: undefined })}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                !sParams.categoryId
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Categories
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat._id.toHexString()}
                href={`/store/${slug}/products${buildQueryString(sParams, { categoryId: cat._id.toHexString(), page: undefined })}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  sParams.categoryId === cat._id.toHexString()
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Desktop Category Sidebar */}
        {categories.length > 0 && (
          <aside className="hidden lg:block w-60 shrink-0 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Categories</h3>
            <div className="space-y-1">
              <Link
                href={`/store/${slug}/products${buildQueryString(sParams, { categoryId: undefined, page: undefined })}`}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !sParams.categoryId
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                All Categories
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat._id.toHexString()}
                  href={`/store/${slug}/products${buildQueryString(sParams, { categoryId: cat._id.toHexString(), page: undefined })}`}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sParams.categoryId === cat._id.toHexString()
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </aside>
        )}

        {/* Product Grid & Pagination */}
        <div className="flex-1 space-y-8">
          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-500">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No products match your criteria</h3>
              <p className="text-sm mt-1">Try clearing your search query or choosing another category.</p>
              <Link
                href={`/store/${slug}/products`}
                className="inline-block mt-4 text-sm font-semibold text-indigo-600 hover:underline"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((product) => (
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-6">
              <div className="text-xs text-slate-500">
                Page <span className="font-bold text-slate-900">{page}</span> of{" "}
                <span className="font-bold text-slate-900">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/store/${slug}/products${buildQueryString(sParams, { page: String(page - 1) })}`}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    &larr; Previous
                  </Link>
                ) : (
                  <span className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed">
                    &larr; Previous
                  </span>
                )}

                {page < totalPages ? (
                  <Link
                    href={`/store/${slug}/products${buildQueryString(sParams, { page: String(page + 1) })}`}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Next &rarr;
                  </Link>
                ) : (
                  <span className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed">
                    Next &rarr;
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
