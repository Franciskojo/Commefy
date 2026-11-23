import React from "react";
import { platformCollection } from "@/lib/db/collections";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addCustomDomain, verifyCustomDomain } from "@/features/tenants/service";
import { requireTenantStaff } from "@/lib/auth/context";
import { parseObjectId } from "@/lib/ids";
import { revalidatePath } from "next/cache";
import { Globe, CheckCircle2, Clock, Plus } from "lucide-react";

async function addDomainAction(formData: FormData) {
  "use server";
  const tenantSlug = formData.get("tenantSlug") as string;
  const hostname = formData.get("hostname") as string;

  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return;

  const staff = await requireTenantStaff(tenant._id, "domain:manage");
  await addCustomDomain({
    tenantId: tenant._id,
    actorUserId: staff.user._id,
    hostname,
  });

  revalidatePath(`/admin/${tenantSlug}/domains`);
}

async function verifyDomainAction(formData: FormData) {
  "use server";
  const tenantSlug = formData.get("tenantSlug") as string;
  const domainId = formData.get("domainId") as string;

  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return;

  await requireTenantStaff(tenant._id, "domain:manage");
  await verifyCustomDomain({
    tenantId: tenant._id,
    domainId: parseObjectId(domainId),
  });

  revalidatePath(`/admin/${tenantSlug}/domains`);
}

export default async function TenantAdminDomainsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return null;

  const customDomainsCol = await platformCollection("customDomains");
  const domains = await customDomainsCol.find({ tenantId: tenant._id }).toArray();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Custom Domains</h1>
        <p className="text-sm text-slate-500 mt-1">
          Connect your custom domain name (e.g. <code>www.yourstore.com</code>) to your StoreForge storefront.
        </p>
      </div>

      {/* Add Domain Form */}
      <Card>
        <CardHeader>
          <CardTitle>Connect a Domain</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addDomainAction} className="flex flex-col sm:flex-row gap-4 items-end">
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <div className="flex-1 w-full">
              <Input
                label="Domain Hostname *"
                name="hostname"
                required
                placeholder="www.yourbrand.com"
                helperText="Enter your domain without http:// or https://"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1.5" /> Add Domain
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Domain List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Domains ({domains.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {domains.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No custom domains added yet. Your store is reachable at <code>/store/{tenantSlug}</code>.
            </div>
          ) : (
            domains.map((dom) => (
              <div
                key={dom._id.toHexString()}
                className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-base">{dom.hostname}</span>
                  </div>
                  <Badge variant={dom.status === "verified" ? "success" : "warning"}>
                    {dom.status}
                  </Badge>
                </div>

                {dom.status === "pending" && (
                  <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs space-y-2">
                    <p className="font-semibold text-slate-800">
                      DNS TXT Verification Required:
                    </p>
                    <p className="text-slate-600 font-mono bg-slate-100 p-2 rounded">
                      Record: TXT · Host: _sf-verification · Value: {dom.verificationToken}
                    </p>
                    <form action={verifyDomainAction} className="pt-2">
                      <input type="hidden" name="tenantSlug" value={tenantSlug} />
                      <input type="hidden" name="domainId" value={dom._id.toHexString()} />
                      <Button size="sm" type="submit">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify Ownership Now
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
