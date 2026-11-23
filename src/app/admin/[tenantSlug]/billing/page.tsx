import React from "react";
import { platformCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { getTenantSubscription, DEFAULT_PLANS } from "@/features/subscriptions/service";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Zap } from "lucide-react";

export default async function TenantAdminBillingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return null;

  const db = await tenantDb(tenant._id);
  const { subscription, plan } = await getTenantSubscription(tenant._id);

  // Current resource counts
  const [productCount, staffCount] = await Promise.all([
    db.products.countDocuments({ status: { $ne: "archived" } }),
    db.memberships.countDocuments({ status: { $in: ["active", "invited"] } }),
  ]);

  const productLimit = plan.limits.products;
  const staffLimit = plan.limits.staff;

  const productPercent =
    productLimit === -1 ? 0 : Math.min(100, Math.round((productCount / productLimit) * 100));
  const staffPercent =
    staffLimit === -1 ? 0 : Math.min(100, Math.round((staffCount / staffLimit) * 100));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">SaaS Subscription & Limits</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor your plan limits, billing renewal status, and feature entitlements.
        </p>
      </div>

      {/* Current Plan Overview Card */}
      <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-0 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Sparkles className="w-48 h-48" />
        </div>
        <CardContent className="p-8 relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                Active Subscription
              </span>
              <h2 className="text-3xl font-black mt-1 text-white">{plan.name} Plan</h2>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="success">Active</Badge>
              <span className="text-sm text-indigo-200">
                {plan.priceMonthly === 0 ? "Free Tier" : `${formatMoney(plan.priceMonthly, plan.currency)} / month`}
              </span>
            </div>
          </div>

          {/* Usage Limit Bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-white/10">
            {/* Products bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">Catalog Capacity</span>
                <span className="text-white">
                  {productCount} / {productLimit === -1 ? "Unlimited" : productLimit} products
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    productPercent > 80 ? "bg-amber-400" : "bg-indigo-400"
                  }`}
                  style={{ width: `${productLimit === -1 ? 15 : productPercent}%` }}
                />
              </div>
            </div>

            {/* Staff bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-300">Team Seats</span>
                <span className="text-white">
                  {staffCount} / {staffLimit === -1 ? "Unlimited" : staffLimit} accounts
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all"
                  style={{ width: `${staffLimit === -1 ? 25 : staffPercent}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans Upgrade Grid */}
      <div className="space-y-4">
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Available Subscription Tiers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DEFAULT_PLANS.map((p) => {
            const isCurrent = p._id === plan._id;
            return (
              <Card
                key={p._id}
                className={`flex flex-col justify-between p-6 ${
                  isCurrent ? "border-2 border-indigo-600 ring-2 ring-indigo-600/10" : ""
                }`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-lg text-slate-900">{p.name}</h4>
                    {isCurrent && <Badge variant="default">Current</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">{p.description}</p>
                  <p className="text-2xl font-black text-slate-900">
                    {p.priceMonthly === 0 ? "Free" : formatMoney(p.priceMonthly, p.currency)}
                    {p.priceMonthly > 0 && <span className="text-xs font-normal text-slate-500"> /mo</span>}
                  </p>

                  <ul className="space-y-2 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {p.limits.products === -1 ? "Unlimited products" : `Up to ${p.limits.products} products`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {p.limits.staff === -1 ? "Unlimited staff" : `Up to ${p.limits.staff} staff accounts`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {p.features.customDomain ? "Custom domain support" : "Platform subdomain"}
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-100">
                  <Button
                    variant={isCurrent ? "outline" : "primary"}
                    disabled={isCurrent}
                    className="w-full text-xs font-semibold"
                  >
                    {isCurrent ? "Active Plan" : "Upgrade Plan"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
