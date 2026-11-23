import React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { parseObjectId } from "@/lib/ids";
import { sha256Hex, safeEqual } from "@/lib/security/crypto";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle2, Clock, PackageCheck, AlertCircle, ShoppingBag, ArrowRight } from "lucide-react";

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug, orderId } = await params;
  const { token } = await searchParams;

  const tenant = await resolveStorefrontTenant(slug);
  const db = await tenantDb(tenant._id);

  let orderObjectId;
  try {
    orderObjectId = parseObjectId(orderId);
  } catch {
    notFound();
  }

  const order = await db.orders.findOne({ _id: orderObjectId });
  if (!order) notFound();

  // IDOR Protection: verify accessTokenHash
  if (!token) {
    // If no token provided, check if user/customer is logged in and owns the order
    const { getCurrentCustomer } = await import("@/lib/auth/context");
    const customer = await getCurrentCustomer(tenant._id);
    if (!customer || !order.customerId || !customer._id.equals(order.customerId)) {
      notFound();
    }
  } else {
    const inputHash = sha256Hex(token);
    if (!safeEqual(inputHash, order.accessTokenHash)) {
      notFound();
    }
  }

  const isPaid = order.status === "paid" || order.status === "processing" || order.status === "shipped" || order.status === "delivered";

  const statusVariant =
    order.status === "paid" || order.status === "processing"
      ? "success"
      : order.status === "shipped" || order.status === "delivered"
      ? "info"
      : order.status === "cancelled" || order.status === "refunded"
      ? "danger"
      : "warning";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Status Hero Card */}
      <div className="text-center space-y-3 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        {isPaid ? (
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
        ) : (
          <Clock className="w-16 h-16 text-amber-500 mx-auto" />
        )}

        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {isPaid ? "Thank You for Your Order!" : "Order Placed — Pending Payment"}
        </h1>

        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          {isPaid
            ? `Your payment has been successfully verified. A confirmation receipt has been sent to ${order.email}.`
            : `Your order #${order.orderNumber} is awaiting payment confirmation.`}
        </p>

        <div className="pt-2 flex items-center justify-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Order #{order.orderNumber}</span>
          <Badge variant={statusVariant}>{order.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Shipping Address */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.region || ""} {order.shippingAddress.postalCode}
            </p>
            <p className="font-medium text-slate-800">{order.shippingAddress.country}</p>
            {order.shippingAddress.phone && <p className="text-xs text-slate-400 mt-2">{order.shippingAddress.phone}</p>}

            <div className="pt-4 mt-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Shipping Method
              </span>
              <p className="font-medium text-slate-800">{order.shippingMethod.name}</p>
            </div>
          </CardContent>
        </Card>

        {/* Ordered Items Snapshot */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Items Ordered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y divide-slate-100">
              {order.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                      {item.variantTitle && (
                        <p className="text-xs text-slate-500">{item.variantTitle}</p>
                      )}
                      <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 shrink-0">
                    {formatMoney(item.lineTotal, order.currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals Summary */}
            <div className="pt-4 border-t border-slate-100 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal, order.currency)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatMoney(order.discountTotal, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span>{order.shippingTotal === 0 ? "FREE" : formatMoney(order.shippingTotal, order.currency)}</span>
              </div>
              {order.taxTotal > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Taxes</span>
                  <span>{formatMoney(order.taxTotal, order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 pt-3 border-t border-slate-100">
                <span>Total Paid</span>
                <span>{formatMoney(order.total, order.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center pt-4">
        <Link href={`/store/${slug}/products`}>
          <Button variant="outline" size="lg">
            Continue Shopping <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
