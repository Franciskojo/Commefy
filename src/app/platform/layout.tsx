import React from "react";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/lib/auth/context";
import { PlatformNav } from "@/components/platform/PlatformNav";
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100">
      <PlatformNav
        actorName={platformActor.user.name}
        actorRole={platformActor.role}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
