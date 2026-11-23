import React from "react";
import { notFound } from "next/navigation";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { CartProvider } from "@/components/storefront/CartContext";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const tenant = await resolveStorefrontTenant(slug);
    const db = await tenantDb(tenant._id);
    const settings = await db.storeSettings.findOne({});

    return {
      title: settings?.seo?.title || tenant.name,
      description: settings?.seo?.description || `Welcome to ${tenant.name}`,
    };
  } catch {
    return {
      title: "StoreForge Store",
    };
  }
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let tenant;
  try {
    tenant = await resolveStorefrontTenant(slug);
  } catch (err: any) {
    if (err?.code === "TENANT_UNAVAILABLE") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Store Unavailable</h1>
            <p className="text-sm text-slate-600 mb-6">{err.message}</p>
            <p className="text-xs text-slate-400">If you are the store owner, please sign in to your dashboard to resolve this.</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";
  const currency = settings?.currency || "USD";

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-slate-50/50">
        <Header
          storeName={settings?.storeName || tenant.name}
          storeSlug={slug}
          logoUrl={settings?.branding?.logoUrl}
          primaryColor={primaryColor}
        />

        <main className="flex-1">{children}</main>

        <Footer
          storeName={settings?.storeName || tenant.name}
          storeSlug={slug}
          tagline={settings?.tagline}
          contactEmail={settings?.contact?.email}
        />

        <CartDrawer storeSlug={slug} currency={currency} />
      </div>
    </CartProvider>
  );
}
