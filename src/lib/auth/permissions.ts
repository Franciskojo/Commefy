import type { PlatformRole, TenantRole } from "@/lib/db/types";

/**
 * Granular permissions for tenant and platform operations.
 */
export type Permission =
  // Tenant store & configuration
  | "store:read"
  | "store:update"
  | "store:delete"
  | "branding:update"
  | "domain:manage"
  | "billing:manage"
  | "payment_keys:manage"

  // Staff & access
  | "staff:read"
  | "staff:invite"
  | "staff:update_role"
  | "staff:remove"

  // Catalog & Inventory
  | "product:read"
  | "product:create"
  | "product:update"
  | "product:delete"
  | "category:manage"
  | "inventory:read"
  | "inventory:adjust"

  // Orders & Fulfillment
  | "order:read"
  | "order:update"
  | "order:cancel"
  | "order:refund"
  | "shipment:manage"

  // Customers & Marketing
  | "customer:read"
  | "customer:update"
  | "discount:manage"
  | "review:manage"

  // Analytics & Audit
  | "analytics:read"
  | "audit:read"

  // Platform super-admin privileges
  | "platform:tenant_read"
  | "platform:tenant_manage"
  | "platform:plan_manage"
  | "platform:user_manage"
  | "platform:feature_flags"
  | "platform:audit_read"
  | "platform:jobs_read"
  | "platform:system_health";

export const TENANT_ROLE_PERMISSIONS: Record<TenantRole, readonly Permission[]> = {
  owner: [
    "store:read",
    "store:update",
    "store:delete",
    "branding:update",
    "domain:manage",
    "billing:manage",
    "payment_keys:manage",
    "staff:read",
    "staff:invite",
    "staff:update_role",
    "staff:remove",
    "product:read",
    "product:create",
    "product:update",
    "product:delete",
    "category:manage",
    "inventory:read",
    "inventory:adjust",
    "order:read",
    "order:update",
    "order:cancel",
    "order:refund",
    "shipment:manage",
    "customer:read",
    "customer:update",
    "discount:manage",
    "review:manage",
    "analytics:read",
    "audit:read",
  ],
  manager: [
    "store:read",
    "store:update",
    "branding:update",
    "staff:read",
    "product:read",
    "product:create",
    "product:update",
    "product:delete",
    "category:manage",
    "inventory:read",
    "inventory:adjust",
    "order:read",
    "order:update",
    "order:cancel",
    "order:refund",
    "shipment:manage",
    "customer:read",
    "customer:update",
    "discount:manage",
    "review:manage",
    "analytics:read",
    "audit:read",
  ],
  catalog_manager: [
    "store:read",
    "product:read",
    "product:create",
    "product:update",
    "product:delete",
    "category:manage",
    "inventory:read",
    "inventory:adjust",
    "review:manage",
  ],
  order_manager: [
    "store:read",
    "product:read",
    "inventory:read",
    "order:read",
    "order:update",
    "order:cancel",
    "order:refund",
    "shipment:manage",
    "customer:read",
  ],
  support: [
    "store:read",
    "product:read",
    "inventory:read",
    "order:read",
    "customer:read",
  ],
};

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  super_admin: [
    "platform:tenant_read",
    "platform:tenant_manage",
    "platform:plan_manage",
    "platform:user_manage",
    "platform:feature_flags",
    "platform:audit_read",
    "platform:jobs_read",
    "platform:system_health",
  ],
  platform_support: [
    "platform:tenant_read",
    "platform:audit_read",
    "platform:jobs_read",
    "platform:system_health",
  ],
};

export function hasTenantPermission(role: TenantRole, permission: Permission): boolean {
  const allowed = TENANT_ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
}

export function hasPlatformPermission(role: PlatformRole, permission: Permission): boolean {
  const allowed = PLATFORM_ROLE_PERMISSIONS[role];
  return allowed ? allowed.includes(permission) : false;
}
