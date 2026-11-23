import React from "react";
import { notFound, redirect } from "next/navigation";
import { platformCollection } from "@/lib/db/collections";
import { requireTenantStaff } from "@/lib/auth/context";
import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Settings,
  CreditCard,
  Globe,
  Sparkles,
  ExternalLink,
  LogOut,
} from "lucide-react";

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) notFound();

  // Enforce server-side staff authorization
  let staff;
  try {
    staff = await requireTenantStaff(tenant._id, "store:read");
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      redirect(`/auth/login?redirect=/admin/${tenantSlug}`);
    }
    // Access denied
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-sm text-slate-600 mb-6">
            You do not have staff permissions for <strong>{tenant.name}</strong>.
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm shadow-sm"
          >
            Sign in with authorized account
          </Link>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: `/admin/${tenantSlug}`, label: "Overview", icon: LayoutDashboard },
    { href: `/admin/${tenantSlug}/products`, label: "Products", icon: Package },
    { href: `/admin/${tenantSlug}/orders`, label: "Orders", icon: ShoppingBag },
    { href: `/admin/${tenantSlug}/staff`, label: "Staff", icon: Users },
    { href: `/admin/${tenantSlug}/settings`, label: "Store Settings", icon: Settings },
    { href: `/admin/${tenantSlug}/payments`, label: "Payment Gateway", icon: CreditCard },
    { href: `/admin/${tenantSlug}/domains`, label: "Custom Domain", icon: Globe },
    { href: `/admin/${tenantSlug}/billing`, label: "Subscription", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        {/* Brand */}
        <div className="p-6 border-b border-slate-800">
          <Link href={`/admin/${tenantSlug}`} className="block">
            <h2 className="text-lg font-bold text-white tracking-tight truncate">{tenant.name}</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mt-0.5 block">
              Store Dashboard
            </span>
          </Link>

          <Link
            href={`/store/${tenantSlug}`}
            target="_blank"
            className="mt-4 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
          >
            <span>View Storefront</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Status Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{staff.user.name}</p>
            <p className="text-[11px] text-slate-400 capitalize">{staff.role.replace("_", " ")}</p>
          </div>
          <Link
            href="/auth/logout"
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
