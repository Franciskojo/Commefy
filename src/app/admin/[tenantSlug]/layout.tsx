import React from "react";
import { notFound, redirect } from "next/navigation";
import { platformCollection } from "@/lib/db/collections";
import { requireTenantStaff } from "@/lib/auth/context";
import { AdminNav } from "@/components/admin/AdminNav";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <AdminNav
        tenantSlug={tenantSlug}
        tenantName={tenant.name}
        staffName={staff.user.name}
        staffRole={staff.role}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
