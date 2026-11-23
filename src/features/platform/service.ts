import "server-only";
import { type ObjectId } from "mongodb";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { recordAudit } from "@/lib/audit";
import { Errors } from "@/lib/errors";
import type { TenantDoc, TenantStatus, AuditLogDoc, FeatureFlagDoc } from "@/lib/db/types";

export interface PlatformMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalOrders: number;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const tenantsCol = await platformCollection("tenants");
  const usersCol = await platformCollection("users");
  const ordersCol = await rawTenantCollection("orders");

  const [totalTenants, activeTenants, suspendedTenants, totalUsers, totalOrders] =
    await Promise.all([
      tenantsCol.countDocuments({}),
      tenantsCol.countDocuments({ status: "active" }),
      tenantsCol.countDocuments({ status: "suspended" }),
      usersCol.countDocuments({}),
      ordersCol.countDocuments({}),
    ]);

  return {
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    totalOrders,
  };
}

export async function listAllTenants(params: {
  status?: TenantStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ tenants: TenantDoc[]; total: number }> {
  const col = await platformCollection("tenants");
  const filter: Record<string, unknown> = {};

  if (params.status) filter["status"] = params.status;
  if (params.search) {
    filter["$or"] = [
      { name: { $regex: params.search, $options: "i" } },
      { slug: { $regex: params.search, $options: "i" } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [tenants, total] = await Promise.all([
    col.find(filter, { sort: { createdAt: -1 }, skip, limit }).toArray(),
    col.countDocuments(filter),
  ]);

  return { tenants, total };
}

export async function updateTenantStatus(params: {
  tenantId: ObjectId;
  status: TenantStatus;
  reason?: string;
  actorUserId: ObjectId;
}): Promise<void> {
  const col = await platformCollection("tenants");
  const now = new Date();

  await col.updateOne(
    { _id: params.tenantId },
    {
      $set: {
        status: params.status,
        suspendedReason: params.status === "suspended" ? params.reason : undefined,
        suspendedAt: params.status === "suspended" ? now : undefined,
        updatedAt: now,
      },
    },
  );

  // Invalidate tenant cache
  const { invalidateTenantCache } = await import("@/lib/tenant/resolve");
  invalidateTenantCache();

  await recordAudit({
    tenantId: params.tenantId,
    category: "platform",
    action: `tenant.${params.status}`,
    outcome: "success",
    actor: { type: "user", id: params.actorUserId.toHexString() },
    target: { type: "tenant", id: params.tenantId.toHexString() },
    metadata: { reason: params.reason },
  });
}

export async function getPlatformAuditLogs(params: {
  category?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: AuditLogDoc[]; total: number }> {
  const col = await platformCollection("auditLogs");
  const filter: Record<string, unknown> = {};
  if (params.category) filter["category"] = params.category;

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    col.find(filter, { sort: { createdAt: -1 }, skip, limit }).toArray(),
    col.countDocuments(filter),
  ]);

  return { logs, total };
}

export async function setFeatureFlag(params: {
  key: string;
  enabled: boolean;
  description: string;
  actorUserId: ObjectId;
}): Promise<void> {
  const col = await platformCollection("featureFlags");
  const now = new Date();

  await col.updateOne(
    { _id: params.key },
    {
      $set: {
        enabled: params.enabled,
        description: params.description,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  await recordAudit({
    category: "platform",
    action: "feature_flag.updated",
    outcome: "success",
    actor: { type: "user", id: params.actorUserId.toHexString() },
    target: { type: "feature_flag", id: params.key },
    metadata: { enabled: params.enabled },
  });
}
