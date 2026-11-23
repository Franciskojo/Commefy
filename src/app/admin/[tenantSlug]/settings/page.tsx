import React from "react";
import { platformCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "./actions";
import { Save, Mail, FileText, Palette } from "lucide-react";

export default async function TenantAdminSettingsPage({
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

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Store Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Customize your storefront identity, brand colors, contact channels, and sovereign customer policies.
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateSettingsAction(formData);
        }}
        className="space-y-8"
      >
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        {/* 1. Branding & Appearance */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Branding & Appearance</CardTitle>
              <p className="text-xs text-slate-500">Visual identity and colors shown across your public storefront.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <Input
              label="Store Display Name *"
              name="storeName"
              defaultValue={settings?.storeName || tenant.name}
              required
            />
            <Input
              label="Store Tagline"
              name="tagline"
              defaultValue={settings?.tagline || ""}
              placeholder="e.g. Sovereign luxury essentials for modern life"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Primary Brand Color (#hex)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    defaultValue={settings?.branding?.primaryColor || "#4f46e5"}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                    name="primaryColor"
                  />
                  <input
                    type="text"
                    defaultValue={settings?.branding?.primaryColor || "#4f46e5"}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase font-mono"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Accent Color (#hex)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    defaultValue={settings?.branding?.accentColor || "#06b6d4"}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                    name="accentColor"
                  />
                  <input
                    type="text"
                    defaultValue={settings?.branding?.accentColor || "#06b6d4"}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase font-mono"
                    readOnly
                  />
                </div>
              </div>
            </div>

            <Input
              label="Logo Image URL"
              name="logoUrl"
              defaultValue={settings?.branding?.logoUrl || ""}
              placeholder="https://example.com/logo.png"
              helperText="Direct image URL for your header brand emblem."
            />
          </CardContent>
        </Card>

        {/* 2. Contact Information */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Contact Information</CardTitle>
              <p className="text-xs text-slate-500">
                Customer support contacts displayed on your storefront Contact and footer pages.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Support Email"
                name="contactEmail"
                type="email"
                defaultValue={settings?.contact?.email || ""}
                placeholder="support@yourstore.com"
                helperText="Where customer inquiries and support tickets are directed."
              />
              <Input
                label="Support Phone"
                name="contactPhone"
                defaultValue={settings?.contact?.phone || ""}
                placeholder="+1 (555) 123-4567"
                helperText="Public customer support phone line or WhatsApp contact."
              />
            </div>
            <Input
              label="Store Physical Address"
              name="contactAddress"
              defaultValue={settings?.contact?.address || ""}
              placeholder="100 Market St, Suite 400, San Francisco, CA 94105"
              helperText="Physical office or fulfillment dispatch location."
            />
          </CardContent>
        </Card>

        {/* 3. Policies & About Story */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Policies & About Story</CardTitle>
              <p className="text-xs text-slate-500">
                Custom copy automatically published to /store/{tenantSlug}/about and /store/{tenantSlug}/policies/*.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                About Your Store (Published to /about)
              </label>
              <textarea
                name="policyAbout"
                rows={4}
                defaultValue={settings?.policies?.about || ""}
                placeholder="Share your brand story, craftsmanship, and mission with your customers..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Shipping & Returns Policy (Published to /policies/shipping-returns)
              </label>
              <textarea
                name="policyShipping"
                rows={3}
                defaultValue={settings?.policies?.shippingReturns || ""}
                placeholder="Domestic shipping arrives in 2-4 business days. Returns accepted within 30 days of delivery..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Privacy Policy (Published to /policies/privacy)
              </label>
              <textarea
                name="policyPrivacy"
                rows={3}
                defaultValue={settings?.policies?.privacy || ""}
                placeholder="Explain how customer data and cookies are handled..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Terms of Service (Published to /policies/terms)
              </label>
              <textarea
                name="policyTerms"
                rows={3}
                defaultValue={settings?.policies?.terms || ""}
                placeholder="Terms governing purchases, order fulfillment, and dispute resolution..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20 px-6">
            <Save className="w-4 h-4 mr-2" /> Save Store Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
