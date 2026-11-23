"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Menu,
  X,
  Store,
} from "lucide-react";

interface AdminNavProps {
  tenantSlug: string;
  tenantName: string;
  staffName: string;
  staffRole: string;
}

export function AdminNav({ tenantSlug, tenantName, staffName, staffRole }: AdminNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: `/admin/${tenantSlug}`, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `/admin/${tenantSlug}/products`, label: "Products", icon: Package },
    { href: `/admin/${tenantSlug}/orders`, label: "Orders", icon: ShoppingBag },
    { href: `/admin/${tenantSlug}/staff`, label: "Staff", icon: Users },
    { href: `/admin/${tenantSlug}/settings`, label: "Store Settings", icon: Settings },
    { href: `/admin/${tenantSlug}/payments`, label: "Payment Gateway", icon: CreditCard },
    { href: `/admin/${tenantSlug}/domains`, label: "Custom Domain", icon: Globe },
    { href: `/admin/${tenantSlug}/billing`, label: "Subscription", icon: Sparkles },
  ];

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {navLinks.map((link) => {
        const Icon = link.icon;
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Top App Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white">
        <Link href={`/admin/${tenantSlug}`} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate text-white leading-tight">{tenantName}</h2>
            <span className="text-[10px] uppercase font-mono text-indigo-400 tracking-wider">
              Merchant Admin
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/store/${tenantSlug}`}
            target="_blank"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs flex items-center gap-1"
            title="Open Storefront"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-5 h-5 text-indigo-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[57px] bottom-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 flex flex-col p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex-1 overflow-y-auto">
            {renderNavLinks(() => setMobileOpen(false))}
          </div>

          {/* User & Sign Out Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-auto">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{staffName}</p>
              <p className="text-xs text-indigo-400 capitalize">{staffRole.replace("_", " ")}</p>
            </div>
            <Link
              href="/auth/logout"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Link>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800 h-screen sticky top-0">
        {/* Brand */}
        <div className="p-6 border-b border-slate-800">
          <Link href={`/admin/${tenantSlug}`} className="block">
            <h2 className="text-lg font-bold text-white tracking-tight truncate">{tenantName}</h2>
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
        {renderNavLinks()}

        {/* User Status Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{staffName}</p>
            <p className="text-[11px] text-slate-400 capitalize">{staffRole.replace("_", " ")}</p>
          </div>
          <Link
            href="/auth/logout"
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </aside>
    </>
  );
}
