import React from "react";
import { platformCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Package,
  Calendar,
  BarChart2,
} from "lucide-react";

export default async function TenantAdminOverviewPage({
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
  const lowStockThreshold = settings?.inventory?.lowStockThreshold ?? 5;

  // Aggregate metrics
  const [orders, lowStockItems, totalProducts] = await Promise.all([
    db.orders.find({}, { sort: { createdAt: -1 }, limit: 100 }).toArray(),
    db.inventory.find({ $expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, lowStockThreshold] } }).limit(5).toArray(),
    db.products.countDocuments({ status: { $ne: "archived" } }),
  ]);

  const paidOrders = orders.filter(
    (o) => o.status === "paid" || o.status === "processing" || o.status === "shipped" || o.status === "delivered"
  );
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrdersCount = orders.filter((o) => o.status === "pending_payment").length;
  const avgOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  // Compute 7-day revenue trend
  const days: { dateKey: string; label: string; isToday: boolean; revenue: number; orderCount: number }[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    const isToday = i === 0;
    const label = isToday
      ? "Today"
      : d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    days.push({ dateKey, label, isToday, revenue: 0, orderCount: 0 });
  }

  for (const order of paidOrders) {
    const oDate = new Date(order.createdAt).toISOString().split("T")[0];
    const dayItem = days.find((d) => d.dateKey === oDate);
    if (dayItem) {
      dayItem.revenue += order.total;
      dayItem.orderCount += 1;
    }
  }

  const maxDailyRevenue = Math.max(...days.map((d) => d.revenue), 100);
  const total7DayRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
  const total7DayOrders = days.reduce((sum, d) => sum + d.orderCount, 0);

  const recentOrders = orders.slice(0, 8);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Store performance metrics and inventory status for {tenant.name}.
        </p>
      </div>

      {/* Low Stock Warning Banner (if any) */}
      {lowStockItems.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">Low Stock Alert</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                {lowStockItems.length} product variants are at or below {lowStockThreshold} units.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/${tenantSlug}/products`}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 underline shrink-0"
          >
            Review Inventory &rarr;
          </Link>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Revenue
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {formatMoney(totalRevenue, currency)}
            </p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">Lifetime paid sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Completed Orders
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{paidOrders.length}</p>
            <p className="text-xs text-slate-500 mt-1">Out of {orders.length} total placed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pending Orders
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{pendingOrdersCount}</p>
            <p className="text-xs text-amber-600 font-semibold mt-1">Awaiting checkout payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Catalog
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{totalProducts}</p>
            <p className="text-xs text-slate-500 mt-1">Listed products</p>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Revenue Trend Chart Card */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">Sales & Revenue Trend</CardTitle>
            </div>
            <p className="text-xs text-slate-500 mt-1">Daily revenue distribution over the last 7 calendar days.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-slate-500">7-Day Gross: </span>
              <span className="font-bold text-slate-900">{formatMoney(total7DayRevenue, currency)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-slate-500">7-Day Orders: </span>
              <span className="font-bold text-slate-900">{total7DayOrders}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-slate-500">Average Order Value: </span>
              <span className="font-bold text-slate-900">{formatMoney(avgOrderValue, currency)}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 px-2">
            {days.map((day) => {
              const heightPercent = Math.max(Math.round((day.revenue / maxDailyRevenue) * 100), 4);

              return (
                <div key={day.dateKey} className="flex-1 flex flex-col items-center h-full justify-end group">
                  {/* Tooltip / Amount label on hover or if revenue > 0 */}
                  <div className="mb-2 text-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      {day.revenue > 0 ? formatMoney(day.revenue, currency) : "–"}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-medium">
                      {day.orderCount} {day.orderCount === 1 ? "order" : "orders"}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="w-full max-w-[48px] bg-slate-100 rounded-t-lg h-36 flex items-end p-0.5">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        day.revenue > 0
                          ? "bg-gradient-to-t from-indigo-600 to-violet-500 shadow-sm"
                          : "bg-slate-200"
                      }`}
                    />
                  </div>

                  {/* Day label */}
                  <span
                    className={`mt-2 text-[10px] sm:text-xs font-medium text-center truncate ${
                      day.isToday ? "text-indigo-600 font-bold" : "text-slate-500"
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Orders Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Orders</CardTitle>
          <Link
            href={`/admin/${tenantSlug}/orders`}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            View all orders <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No orders placed in your store yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Order</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((order) => {
                    const statusVariant =
                      order.status === "paid" || order.status === "processing"
                        ? "success"
                        : order.status === "shipped" || order.status === "delivered"
                        ? "info"
                        : order.status === "cancelled" || order.status === "refunded"
                        ? "danger"
                        : "warning";

                    return (
                      <tr key={order._id.toHexString()} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          #{order.orderNumber}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{order.shippingAddress.name}</p>
                          <p className="text-xs text-slate-500">{order.email}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant}>{order.status.replace("_", " ")}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          {formatMoney(order.total, order.currency)}
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
