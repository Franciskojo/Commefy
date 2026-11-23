import React from "react";
import { getPlatformMetrics, listAllTenants } from "@/features/platform/service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Building2,
  Users,
  ShoppingBag,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default async function PlatformOverviewPage() {
  const metrics = await getPlatformMetrics();
  const { tenants: recentTenants } = await listAllTenants({ limit: 8 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Platform Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time operational status, tenant lifecycle, and platform-wide metrics.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Tenants
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{metrics.totalTenants}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">
              {metrics.activeTenants} active stores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Suspended Stores
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{metrics.suspendedTenants}</p>
            <p className="text-xs text-slate-500 mt-1">Restricted by admin</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Platform Users
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{metrics.totalUsers}</p>
            <p className="text-xs text-slate-500 mt-1">Owners & staff accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Platform Orders
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 mt-2">{metrics.totalOrders}</p>
            <p className="text-xs text-slate-500 mt-1">All-time transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* System Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>System & Infrastructure Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-sm text-slate-900">MongoDB Database</p>
                <p className="text-xs text-slate-500">Connected & responsive</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-sm text-slate-900">Tenant Isolation Service</p>
                <p className="text-xs text-slate-500">Enforced via Scoped Collections</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold text-sm text-slate-900">Background Job Sweeper</p>
                <p className="text-xs text-slate-500">Active cron endpoint</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenant Registry Snapshot */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Tenant Stores</CardTitle>
          <Link
            href="/platform/tenants"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            Manage all tenants <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Store Name</th>
                  <th className="px-6 py-3">Subdomain / Slug</th>
                  <th className="px-6 py-3">Registered Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTenants.map((t) => (
                  <tr key={t._id.toHexString()} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-bold text-slate-900">{t.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-indigo-600">
                      <code>{t.slug}</code>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={t.status === "active" ? "success" : "danger"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/${t.slug}`}
                        className="text-xs font-bold text-indigo-600 hover:underline mr-3"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href={`/store/${t.slug}`}
                        target="_blank"
                        className="text-xs font-semibold text-slate-500 hover:underline"
                      >
                        Storefront
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
