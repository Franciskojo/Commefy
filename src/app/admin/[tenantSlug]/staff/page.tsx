import React from "react";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inviteStaffAction, removeStaffAction } from "./actions";
import { UserPlus, Trash2 } from "lucide-react";

export default async function TenantAdminStaffPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenantsCol = await platformCollection("tenants");
  const tenant = await tenantsCol.findOne({ slug: tenantSlug });
  if (!tenant) return null;

  const db = await tenantDb(tenant._id);
  const memberships = await db.memberships.find({ status: { $ne: "revoked" } }).toArray();

  const userIds = memberships.map((m) => m.userId).filter(Boolean) as (import("mongodb").ObjectId)[];
  const usersCol = await platformCollection("users");
  const users = await usersCol.find({ _id: { $in: userIds } }).toArray();
  const userMap = new Map(users.map((u) => [u._id.toHexString(), u]));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Staff & Permissions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Invite team members and assign role-based store access.
        </p>
      </div>

      {/* Invite Member Form */}
      <Card>
        <CardHeader>
          <CardTitle>Invite New Team Member</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await inviteStaffAction(formData);
            }}
            className="flex flex-col sm:flex-row gap-4 items-end"
          >
            <input type="hidden" name="tenantSlug" value={tenantSlug} />
            <div className="flex-1 w-full">
              <Input
                label="Email Address *"
                name="email"
                type="email"
                required
                placeholder="colleague@example.com"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Role *</label>
              <select
                name="role"
                defaultValue="manager"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="manager">Store Manager</option>
                <option value="catalog_manager">Catalog Manager</option>
                <option value="order_manager">Order Manager</option>
                <option value="support">Customer Support</option>
              </select>
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-1.5" /> Send Invitation
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Staff Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Staff ({memberships.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {memberships.map((m) => {
              const u = m.userId ? userMap.get(m.userId.toHexString()) : null;
              const isOwner = m.role === "owner";

              return (
                <div
                  key={m._id.toHexString()}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-900">
                      {u ? u.name : m.invitedEmail}
                    </p>
                    <p className="text-xs text-slate-500">{u ? u.email : "Invitation pending"}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant={isOwner ? "default" : "neutral"}>
                      {m.role.replace("_", " ")}
                    </Badge>

                    {!isOwner && (
                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await removeStaffAction(formData);
                        }}
                      >
                        <input type="hidden" name="tenantSlug" value={tenantSlug} />
                        <input type="hidden" name="membershipId" value={m._id.toHexString()} />
                        <button
                          type="submit"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Revoke Staff Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
