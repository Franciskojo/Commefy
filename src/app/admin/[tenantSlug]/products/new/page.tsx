import React from "react";
import { createProductAction } from "./actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={`/admin/${tenantSlug}/products`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">Create Product</h1>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await createProductAction(formData);
        }}
      >
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        <Card className="space-y-6">
          <CardHeader>
            <CardTitle>General Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Product Title *"
              name="name"
              required
              placeholder="e.g. Wireless Ergonomic Keyboard"
            />
            <Input
              label="Brand / Manufacturer"
              name="brand"
              placeholder="e.g. Acme Tech"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
              <textarea
                name="description"
                required
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Detailed description of features, materials, and specs..."
              />
            </div>
            <Input
              label="Product Image URL"
              name="imageUrl"
              placeholder="https://images.unsplash.com/..."
              helperText="Paste an image link or leave blank for placeholder"
            />
          </CardContent>

          <CardHeader className="pt-0">
            <CardTitle>Pricing & Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Base Price ($) *"
                name="price"
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="29.99"
              />
              <Input
                label="Sale Price ($ - Optional)"
                name="salePrice"
                type="number"
                step="0.01"
                placeholder="24.99"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SKU Identifier *"
                name="sku"
                required
                placeholder="PROD-001"
              />
              <Input
                label="Initial Stock Units *"
                name="initialStock"
                type="number"
                defaultValue="20"
                min="0"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Link href={`/admin/${tenantSlug}/products`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit">
                <Plus className="w-4 h-4 mr-1.5" /> Publish Product
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
