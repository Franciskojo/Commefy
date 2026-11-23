import "server-only";
import type { Collection, Document } from "mongodb";
import { getDb } from "./client";
import type * as T from "./types";

/**
 * Collection registry.
 *
 * Tenant-owned collections are deliberately NOT exported as raw collections here. They must be
 * accessed through `tenantCollection()` in `./scoped.ts`, which enforces tenant scoping.
 * `rawTenantCollection` exists for the scoped wrapper, migrations, and explicitly audited
 * platform workflows only; ESLint restricts where it may be imported.
 */

export interface PlatformCollections {
  tenants: T.TenantDoc;
  users: T.UserDoc;
  sessions: T.SessionDoc;
  authTokens: T.AuthTokenDoc;
  subscriptionPlans: T.SubscriptionPlanDoc;
  auditLogs: T.AuditLogDoc;
  webhookEvents: T.WebhookEventDoc;
  notificationJobs: T.NotificationJobDoc;
  featureFlags: T.FeatureFlagDoc;
  rateLimits: T.RateLimitDoc;
  counters: T.CounterDoc;
  devEmails: T.DevEmailDoc;
  /** Hostname → tenant mapping; verified hostnames are globally unique. */
  customDomains: T.CustomDomainDoc;
}

export interface TenantCollections {
  memberships: T.MembershipDoc;
  storeSettings: T.StoreSettingsDoc;
  paymentConfigs: T.PaymentConfigDoc;
  products: T.ProductDoc;
  categories: T.CategoryDoc;
  inventory: T.InventoryDoc;
  stockMovements: T.StockMovementDoc;
  carts: T.CartDoc;
  customers: T.CustomerDoc;
  addresses: T.AddressDoc;
  orders: T.OrderDoc;
  payments: T.PaymentDoc;
  refunds: T.RefundDoc;
  shipments: T.ShipmentDoc;
  discounts: T.DiscountDoc;
  reviews: T.ReviewDoc;
  subscriptions: T.SubscriptionDoc;
  invoices: T.InvoiceDoc;
  idempotencyRecords: T.IdempotencyRecordDoc;
  media: T.MediaDoc;
}

export type PlatformCollectionName = keyof PlatformCollections;
export type TenantCollectionName = keyof TenantCollections;

export const TENANT_COLLECTIONS: readonly TenantCollectionName[] = [
  "memberships",
  "storeSettings",
  "paymentConfigs",
  "products",
  "categories",
  "inventory",
  "stockMovements",
  "carts",
  "customers",
  "addresses",
  "orders",
  "payments",
  "refunds",
  "shipments",
  "discounts",
  "reviews",
  "subscriptions",
  "invoices",
  "idempotencyRecords",
  "media",
] as const;

export async function platformCollection<K extends PlatformCollectionName>(
  name: K,
): Promise<Collection<PlatformCollections[K]>> {
  const db = await getDb();
  return db.collection<PlatformCollections[K]>(name);
}

/** @internal – only for `scoped.ts`, index bootstrap, and audited cross-tenant platform code. */
export async function rawTenantCollection<K extends TenantCollectionName>(
  name: K,
): Promise<Collection<TenantCollections[K] & Document>> {
  const db = await getDb();
  return db.collection<TenantCollections[K] & Document>(name);
}
