import { describe, it, expect } from "vitest";
import {
  hasTenantPermission,
  hasPlatformPermission,
  TENANT_ROLE_PERMISSIONS,
  PLATFORM_ROLE_PERMISSIONS,
} from "@/lib/auth/permissions";

describe("Role and Permission Enforcement", () => {
  it("allows store owner full tenant access including payment keys and billing", () => {
    expect(hasTenantPermission("owner", "payment_keys:manage")).toBe(true);
    expect(hasTenantPermission("owner", "billing:manage")).toBe(true);
    expect(hasTenantPermission("owner", "staff:remove")).toBe(true);
    expect(hasTenantPermission("owner", "product:delete")).toBe(true);
    expect(hasTenantPermission("owner", "order:refund")).toBe(true);
  });

  it("prevents store managers from touching payment secrets and billing", () => {
    expect(hasTenantPermission("manager", "product:create")).toBe(true);
    expect(hasTenantPermission("manager", "order:update")).toBe(true);
    expect(hasTenantPermission("manager", "payment_keys:manage")).toBe(false);
    expect(hasTenantPermission("manager", "billing:manage")).toBe(false);
    expect(hasTenantPermission("manager", "staff:remove")).toBe(false);
  });

  it("restricts catalog manager to products, categories, and inventory only", () => {
    expect(hasTenantPermission("catalog_manager", "product:create")).toBe(true);
    expect(hasTenantPermission("catalog_manager", "inventory:adjust")).toBe(true);
    expect(hasTenantPermission("catalog_manager", "order:read")).toBe(false);
    expect(hasTenantPermission("catalog_manager", "order:update")).toBe(false);
    expect(hasTenantPermission("catalog_manager", "payment_keys:manage")).toBe(false);
  });

  it("restricts order manager to orders and shipments", () => {
    expect(hasTenantPermission("order_manager", "order:read")).toBe(true);
    expect(hasTenantPermission("order_manager", "order:update")).toBe(true);
    expect(hasTenantPermission("order_manager", "shipment:manage")).toBe(true);
    expect(hasTenantPermission("order_manager", "product:delete")).toBe(false);
    expect(hasTenantPermission("order_manager", "payment_keys:manage")).toBe(false);
  });

  it("restricts support to read-only customer and order data", () => {
    expect(hasTenantPermission("support", "order:read")).toBe(true);
    expect(hasTenantPermission("support", "customer:read")).toBe(true);
    expect(hasTenantPermission("support", "order:update")).toBe(false);
    expect(hasTenantPermission("support", "order:cancel")).toBe(false);
    expect(hasTenantPermission("support", "payment_keys:manage")).toBe(false);
  });

  it("strictly separates platform roles from tenant roles", () => {
    expect(hasPlatformPermission("super_admin", "platform:tenant_manage")).toBe(true);
    expect(hasPlatformPermission("super_admin", "platform:plan_manage")).toBe(true);
    expect(hasPlatformPermission("platform_support", "platform:tenant_manage")).toBe(false);
    expect(hasPlatformPermission("platform_support", "platform:tenant_read")).toBe(true);
  });
});
