import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default async function StorefrontPolicyPage({
  params,
}: {
  params: Promise<{ slug: string; policy: string }>;
}) {
  const { slug, policy } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);
  const settings = await db.storeSettings.findOne({});
  const storeName = settings?.storeName || tenant.name;

  let title: string;
  let content: string;

  if (policy === "privacy") {
    title = "Privacy Policy";
    content =
      settings?.policies?.privacy ||
      `${storeName} respects your privacy. Personal information collected during checkout is used solely to process, fulfill, and support your orders.`;
  } else if (policy === "terms") {
    title = "Terms of Service";
    content =
      settings?.policies?.terms ||
      `By placing an order with ${storeName}, you agree to our standard commercial terms of sale, payment verification, and fulfillment policies.`;
  } else if (policy === "shipping") {
    title = "Shipping & Returns";
    content =
      settings?.policies?.shippingReturns ||
      `Orders are processed promptly and shipped via tracked courier. Eligible items in unused condition may be returned within 14 days of delivery.`;
  } else {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <Link
          href={`/store/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {storeName}
        </Link>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{title}</h1>
      </div>

      <Card>
        <CardContent className="p-8 text-slate-700 leading-relaxed whitespace-pre-line text-sm sm:text-base">
          {content}
        </CardContent>
      </Card>
    </div>
  );
}

