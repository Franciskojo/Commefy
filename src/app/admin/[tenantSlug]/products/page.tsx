import React from "react";
import { platformCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Package, ShoppingBag } from "lucide-react";

export default async function TenantAdminProductsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return null;

  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});
  const currency = settings?.currency || "USD";

  const products = await db.products.find({}, { sort: { createdAt: -1 } }).toArray();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Products</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your store catalog, variants, pricing, and stock.
          </p>
        </div>

        <Link href={`/admin/${tenantSlug}/products/new`}>
          <Button className="shadow-md">
            <Plus className="w-4 h-4 mr-1.5" /> Add New Product
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">No products added yet</h3>
              <p className="text-sm max-w-sm mx-auto">
                Get started by adding your first product to begin selling online.
              </p>
              <Link href={`/admin/${tenantSlug}/products/new`} className="inline-block mt-2">
                <Button size="sm">Create First Product</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">SKU</th>
                    <th className="px-6 py-3">Variants</th>
                    <th className="px-6 py-3">Base Price</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => {
                    const firstVariant = product.variants[0];
                    return (
                      <tr key={product._id.toHexString()} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                              {product.images?.[0]?.url ? (
                                <img
                                  src={product.images[0].url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ShoppingBag className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{product.name}</p>
                              {product.brand && (
                                <p className="text-xs text-indigo-600 font-semibold">{product.brand}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-600">
                          {firstVariant?.sku || "—"}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-700">
                          {product.variants.length} variant{product.variants.length > 1 ? "s" : ""}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900">
                          {formatMoney(product.priceMin, currency)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={product.status === "active" ? "success" : "neutral"}>
                            {product.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/store/${tenantSlug}/products/${product.slug}`}
                            target="_blank"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
