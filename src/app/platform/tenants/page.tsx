import Link from "next/link";
import { listAllTenants } from "@/features/platform/service";
import { requirePlatformStaff } from "@/lib/auth/context";
import { toggleTenantStatusAction } from "./actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, ShieldCheck, ShieldAlert, PauseCircle, PlayCircle, Search } from "lucide-react";
import type { TenantStatus } from "@/lib/db/types";

export default async function PlatformTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  await requirePlatformStaff("platform:tenant_manage");
  const { status, search } = await searchParams;

  const validStatus = status === "active" || status === "suspended" || status === "provisioning" ? (status as TenantStatus) : undefined;
  const { tenants, total } = await listAllTenants({
    status: validStatus,
    search,
    limit: 50,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tenant Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage provisioned storefront organizations, operational status, and tenant isolation policies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral" className="text-xs font-mono">
            {total} Total Registered
          </Badge>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/platform/tenants"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                !status ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Tenants
            </Link>
            <Link
              href="/platform/tenants?status=active"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === "active" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Active
            </Link>
            <Link
              href="/platform/tenants?status=suspended"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === "suspended" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Suspended
            </Link>
          </div>

          <form method="GET" className="w-full sm:w-72 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="search"
                defaultValue={search || ""}
                placeholder="Search tenant name or slug..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Store / Organization</th>
                  <th className="px-6 py-4">Slug & Subdomain</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Provisioned</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => {
                  const isSuspended = t.status === "suspended";

                  return (
                    <tr key={t._id.toHexString()} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                            {t.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{t.name}</p>
                            <p className="text-xs text-slate-400 font-mono">ID: {t._id.toHexString()}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="font-mono text-xs text-slate-800 font-semibold">{t.slug}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{t.slug}.storeforge.com</p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <Badge variant={t.status === "active" ? "success" : isSuspended ? "danger" : "warning"}>
                            {t.status.toUpperCase()}
                          </Badge>
                          {t.suspendedReason && (
                            <p className="text-[11px] text-rose-500 max-w-xs truncate" title={t.suspendedReason}>
                              {t.suspendedReason}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/${t.slug}`}
                            target="_blank"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Open Tenant Admin"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/store/${t.slug}`}
                            target="_blank"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Visit Public Storefront"
                          >
                            <Building2 className="w-4 h-4" />
                          </Link>

                          {isSuspended ? (
                            <form
                              action={async (formData: FormData) => {
                                "use server";
                                await toggleTenantStatusAction(formData);
                              }}
                            >
                              <input type="hidden" name="tenantId" value={t._id.toHexString()} />
                              <input type="hidden" name="status" value="active" />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs py-1 h-8"
                              >
                                <PlayCircle className="w-3.5 h-3.5 mr-1" /> Reactivate
                              </Button>
                            </form>
                          ) : (
                            <form
                              action={async (formData: FormData) => {
                                "use server";
                                await toggleTenantStatusAction(formData);
                              }}
                            >
                              <input type="hidden" name="tenantId" value={t._id.toHexString()} />
                              <input type="hidden" name="status" value="suspended" />
                              <input type="hidden" name="reason" value="Platform administrative freeze" />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                                className="text-rose-700 border-rose-300 hover:bg-rose-50 text-xs py-1 h-8"
                              >
                                <PauseCircle className="w-3.5 h-3.5 mr-1" /> Suspend
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                      No tenants found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
