import React from "react";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/auth/context";
import Link from "next/link";

export const dynamic = "force-dynamic";
import {
  ShieldAlert,
  Building2,
  Users,
  Activity,
  Flag,
  FileText,
  LogOut,
  ExternalLink,
} from "lucide-react";

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let platformActor;
  try {
    platformActor = await requirePlatformStaff();
  } catch (err: any) {
    if (err?.code === "MFA_REQUIRED") {
      redirect("/auth/mfa?redirect=/platform");
    }
    // Access denied / Unauthenticated
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
        <div className="max-w-md w-full bg-slate-950 rounded-2xl shadow-2xl p-8 text-center border border-slate-800 text-white">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-2">Restricted Platform Access</h1>
          <p className="text-sm text-slate-400 mb-6">
            This area is restricted to StoreForge platform operators and super-administrators.
          </p>
          <Link
            href="/auth/login?redirect=/platform"
            className="inline-block px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm shadow-sm hover:bg-indigo-700"
          >
            Sign in with Platform Credentials
          </Link>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/platform", label: "Platform Overview", icon: Activity },
    { href: "/platform/tenants", label: "Tenant Registry", icon: Building2 },
    { href: "/platform/audit", label: "Security & Audit Logs", icon: FileText },
    { href: "/platform/flags", label: "Feature Flags", icon: Flag },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Super Admin Sidebar */}
      <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-400 font-black tracking-tight text-lg">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <span>StoreForge</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mt-1 block">
            Super-Admin Console
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-900 hover:text-white transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-400" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-white truncate">{platformActor.user.name}</p>
            <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">
              {platformActor.role.replace("_", " ")}
            </p>
          </div>
          <Link
            href="/auth/logout"
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900"
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
