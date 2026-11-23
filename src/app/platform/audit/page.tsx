import Link from "next/link";
import { getPlatformAuditLogs } from "@/features/platform/service";
import { requirePlatformStaff } from "@/lib/auth/context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Clock, User, Filter } from "lucide-react";

export default async function PlatformAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requirePlatformStaff("platform:audit_read");
  const { category } = await searchParams;

  const { logs, total } = await getPlatformAuditLogs({
    category,
    limit: 50,
  });

  const categories = ["all", "security", "platform", "commerce", "billing"];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Security & Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, tamper-evident record of all critical authentication, tenancy, authorization, and administrative events.
          </p>
        </div>
        <Badge variant="neutral" className="text-xs font-mono">
          {total} Captured Events
        </Badge>
      </div>

      {/* Category Filter Chips */}
      <Card>
        <CardContent className="p-4 flex items-center gap-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          {categories.map((c) => {
            const isSelected = (!category && c === "all") || category === c;
            const href = c === "all" ? "/platform/audit" : `/platform/audit?category=${c}`;

            return (
              <Link
                key={c}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 ${
                  isSelected
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {c}
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Outcome</th>
                  <th className="px-6 py-4">Actor</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {logs.map((log) => {
                  const isSuccess = log.outcome === "success";
                  const isDenied = log.outcome === "denied";

                  return (
                    <tr key={log._id.toHexString()} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-sans">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-sans px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold uppercase">
                          {log.category}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-bold text-slate-900">
                        {log.action}
                      </td>

                      <td className="px-6 py-4">
                        <Badge variant={isSuccess ? "success" : isDenied ? "danger" : "warning"}>
                          {log.outcome.toUpperCase()}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-sans">
                          <span className="font-semibold text-slate-900">
                            {log.actor?.email || log.actor?.type || "system"}
                          </span>
                          {log.actor?.id && (
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                              {log.actor.id}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-500 font-sans text-xs">
                        {log.metadata ? (
                          <span className="text-slate-600 truncate block max-w-xs font-mono text-[11px]">
                            {JSON.stringify(log.metadata)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm font-sans">
                      No audit events recorded for this criteria.
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
