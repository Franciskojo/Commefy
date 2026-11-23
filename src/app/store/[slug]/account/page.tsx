import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { tenantDb } from "@/lib/db/scoped";
import { getCurrentCustomer } from "@/lib/auth/context";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, User, ShoppingBag, Clock, ExternalLink, LogOut } from "lucide-react";

export default async function CustomerAccountPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);
  const customer = await getCurrentCustomer(tenant._id);

  if (!customer) {
    redirect(`/store/${slug}/account/login`);
  }

  const db = await tenantDb(tenant._id);
  const [settings, orders] = await Promise.all([
    db.storeSettings.findOne({}),
    db.orders.find({ customerId: customer._id }, { sort: { createdAt: -1 } }).toArray(),
  ]);

  const currency = settings?.currency || "USD";
  const primaryColor = settings?.branding?.primaryColor || "#4f46e5";

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Account Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800">{customer.name}</strong> ({customer.email})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/store/${slug}/products`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ShoppingBag className="w-4 h-4" /> Continue Shopping
            </Button>
          </Link>

          <form action={`/store/${slug}/account/logout`} method="POST">
            <Button variant="ghost" size="sm" className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" /> Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Name</p>
                <p className="font-semibold text-slate-900">{customer.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email Address</p>
                <p className="font-semibold text-slate-900">{customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Customer Since</p>
                <p className="font-semibold text-slate-900">
                  {new Date(customer.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Orders Placed</p>
                <p className="font-semibold text-slate-900">{orders.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order History */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" /> Order History ({orders.length})
          </h2>

          {orders.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No orders placed yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When you purchase items from our catalog, you will find order confirmations and tracking information right here.
                </p>
                <div className="pt-2">
                  <Link href={`/store/${slug}/products`}>
                    <Button style={{ backgroundColor: primaryColor }} className="text-white">
                      Browse Catalog
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const orderDate = new Date(order.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });

                return (
                  <Card key={order._id.toHexString()} className="overflow-hidden border-slate-200 hover:shadow-md transition-shadow">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-slate-500">Order</span>{" "}
                          <span className="font-mono font-bold text-slate-900">#{order.orderNumber}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{orderDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            order.status === "paid" || order.status === "delivered" || order.status === "shipped"
                              ? "success"
                              : order.status === "cancelled"
                              ? "danger"
                              : "neutral"
                          }
                        >
                          {order.status.toUpperCase()}
                        </Badge>
                        <span className="font-bold text-slate-900 text-sm">
                          {formatMoney(order.total, currency)}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {order.items.map((l) => `${l.name} (x${l.quantity})`).join(", ")}
                        </p>
                      </div>

                      <Link href={`/store/${slug}/orders/${order._id.toHexString()}`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <span>View Invoice & Tracking</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
