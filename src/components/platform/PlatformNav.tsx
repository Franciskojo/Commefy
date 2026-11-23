"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldAlert,
  Building2,
  Activity,
  Flag,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";

interface PlatformNavProps {
  actorName: string;
  actorRole: string;
}

export function PlatformNav({ actorName, actorRole }: PlatformNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/platform", label: "Platform Overview", icon: Activity, exact: true },
    { href: "/platform/tenants", label: "Tenant Registry", icon: Building2 },
    { href: "/platform/audit", label: "Security & Audit Logs", icon: FileText },
    { href: "/platform/flags", label: "Feature Flags", icon: Flag },
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
                : "text-slate-300 hover:bg-slate-900 hover:text-white"
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
      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-white">
        <Link href="/platform" className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Commefy Platform</h2>
            <span className="text-[10px] uppercase font-mono text-rose-400 tracking-wider">
              Super-Admin
            </span>
          </div>
        </Link>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="w-5 h-5 text-indigo-400" /> : <Menu className="w-5 h-5" />}
        </button>
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
              <p className="text-sm font-semibold text-white truncate">{actorName}</p>
              <p className="text-xs text-rose-400 capitalize">{actorRole.replace("_", " ")}</p>
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
      <aside className="hidden lg:flex w-64 bg-slate-950 text-slate-300 flex-col shrink-0 border-r border-slate-800 h-screen sticky top-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-400 font-black tracking-tight text-lg">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <span>StoreForge</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mt-1 block">
            Super-Admin Console
          </span>
        </div>

        {/* Links */}
        {renderNavLinks()}

        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-white truncate">{actorName}</p>
            <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">
              {actorRole.replace("_", " ")}
            </p>
          </div>
          <Link
            href="/auth/logout"
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </Link>
        </div>
      </aside>
    </>
  );
}
