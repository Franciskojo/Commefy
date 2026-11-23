import React from "react";
import Link from "next/link";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Truck, Sparkles, ArrowRight } from "lucide-react";

export default async function StorefrontAboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});

  const storeName = settings?.storeName || tenant.name;
  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";
  const aboutText =
    settings?.policies?.about ||
    `${storeName} is dedicated to bringing you thoughtfully curated products built with quality, reliability, and timeless design in mind.`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div>
        <Link
          href={`/store/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {storeName}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3 tracking-tight">
          About {storeName}
        </h1>
        {settings?.tagline && (
          <p className="text-lg text-slate-600 mt-2">{settings.tagline}</p>
        )}
      </div>

      <Card>
        <CardContent className="p-8 space-y-6 text-slate-700 leading-relaxed">
          <div className="whitespace-pre-line text-base">{aboutText}</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Curated Quality
              </div>
              <p className="text-xs text-slate-500">
                Every item in our catalog is selected and inspected to meet strict quality standards.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Verified & Secure
              </div>
              <p className="text-xs text-slate-500">
                Protected checkout and transparent order tracking from purchase to delivery.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Truck className="w-4 h-4 text-indigo-600" /> Reliable Fulfillment
              </div>
              <p className="text-xs text-slate-500">
                Prompt dispatch and responsive customer support whenever you need assistance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/store/${slug}/products`}>
          <Button style={{ backgroundColor: primaryColor }} className="text-white font-semibold">
            Explore Products <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Link href={`/store/${slug}/contact`}>
          <Button variant="outline">Contact Us</Button>
        </Link>
      </div>
    </div>
  );
}

