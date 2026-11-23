import React from "react";
import { platformCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";

export default async function TenantAdminOrdersPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return null;

  const db = await tenantDb(tenant._id);
  const orders = await db.orders.find({}, { sort: { createdAt: -1 }, limit: 100 }).toArray();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Orders</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor and manage customer orders, fulfillment, and refunds.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No orders found</h3>
              <p className="text-sm mt-1">Orders placed on your storefront will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Order Number</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
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
                        <td className="px-6 py-4 text-xs text-slate-700">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} items
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
