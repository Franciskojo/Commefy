import "server-only";
import type { Db, IndexDescription } from "mongodb";
import { getDb } from "./client";

/**
 * Index and JSON-schema validator definitions. Applied idempotently by `npm run db:init`
 * (scripts/db-init.ts) and by the integration test harness. See docs/database.md.
 */

export const INDEXES: Record<string, IndexDescription[]> = {
  tenants: [
    { key: { slug: 1 }, unique: true, name: "slug_unique" },
    { key: { status: 1, createdAt: -1 }, name: "status_created" },
    { key: { ownerUserId: 1 }, name: "owner" },
  ],
  users: [
    { key: { email: 1 }, unique: true, name: "email_unique" },
    { key: { platformRole: 1 }, sparse: true, name: "platform_role" },
  ],
  memberships: [
    { key: { tenantId: 1, userId: 1 }, unique: true, partialFilterExpression: { userId: { $exists: true }, status: { $in: ["invited", "active"] } }, name: "tenant_user_unique_live" },
    { key: { userId: 1, status: 1 }, name: "user_status" },
    { key: { tenantId: 1, invitedEmail: 1 }, sparse: true, name: "tenant_invited_email" },
  ],
  sessions: [
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl_idle" },
    { key: { userId: 1 }, sparse: true, name: "user" },
    { key: { tenantId: 1, customerId: 1 }, sparse: true, name: "tenant_customer" },
  ],
  authTokens: [
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl" },
    { key: { type: 1, userId: 1 }, name: "type_user" },
  ],
  subscriptionPlans: [{ key: { active: 1, sortOrder: 1 }, name: "active_sort" }],
  subscriptions: [
    { key: { tenantId: 1 }, unique: true, name: "tenant_unique" },
    { key: { status: 1, currentPeriodEnd: 1 }, name: "status_period_end" },
    { key: { providerSubscriptionId: 1 }, sparse: true, unique: true, name: "provider_sub_unique" },
  ],
  invoices: [
    { key: { tenantId: 1, createdAt: -1 }, name: "tenant_created" },
    { key: { tenantId: 1, number: 1 }, unique: true, name: "tenant_number_unique" },
    { key: { providerInvoiceId: 1 }, sparse: true, unique: true, name: "provider_invoice_unique" },
  ],
  customDomains: [
    { key: { hostname: 1 }, unique: true, partialFilterExpression: { status: "verified" }, name: "hostname_verified_unique" },
    { key: { tenantId: 1, hostname: 1 }, unique: true, name: "tenant_hostname_unique" },
  ],
  auditLogs: [
    { key: { tenantId: 1, createdAt: -1 }, name: "tenant_created" },
    { key: { category: 1, createdAt: -1 }, name: "category_created" },
    { key: { createdAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 400, name: "ttl_400d" },
  ],
  webhookEvents: [
    { key: { provider: 1, eventId: 1 }, unique: true, name: "provider_event_unique" },
    { key: { status: 1, receivedAt: -1 }, name: "status_received" },
    { key: { receivedAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 90, name: "ttl_90d" },
  ],
  idempotencyRecords: [
    { key: { tenantId: 1, scope: 1, key: 1 }, unique: true, name: "tenant_scope_key_unique" },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl" },
  ],
  notificationJobs: [
    { key: { status: 1, runAt: 1 }, name: "status_runat" },
    { key: { dedupeKey: 1 }, unique: true, partialFilterExpression: { dedupeKey: { $type: "string" }, status: { $in: ["queued", "running"] } }, name: "dedupe_live" },
    { key: { updatedAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 30, partialFilterExpression: { status: "succeeded" }, name: "ttl_succeeded_30d" },
  ],
  featureFlags: [],
  rateLimits: [{ key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl" }],
  counters: [],
  devEmails: [{ key: { createdAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 7, name: "ttl_7d" }],

  storeSettings: [{ key: { tenantId: 1 }, unique: true, name: "tenant_unique" }],
  paymentConfigs: [{ key: { tenantId: 1 }, unique: true, name: "tenant_unique" }],
  products: [
    { key: { tenantId: 1, slug: 1 }, unique: true, name: "tenant_slug_unique" },
    // Soft-deleted products get their SKUs suffixed (see products service) so they remain unique.
    { key: { tenantId: 1, "variants.sku": 1 }, unique: true, name: "tenant_sku_unique" },
    { key: { tenantId: 1, status: 1, createdAt: -1 }, name: "tenant_status_created" },
    { key: { tenantId: 1, status: 1, priceMin: 1 }, name: "tenant_status_price" },
    { key: { tenantId: 1, categoryIds: 1, status: 1 }, name: "tenant_category_status" },
    { key: { tenantId: 1, featured: 1, status: 1 }, name: "tenant_featured" },
    { key: { tenantId: 1, salesCount: -1 }, name: "tenant_sales" },
    // Tenant-prefixed text index: text queries must include tenantId equality (always true via scoped wrapper).
    { key: { tenantId: 1, name: "text", description: "text", tags: "text", brand: "text" }, weights: { name: 10, tags: 5, brand: 3, description: 1 }, name: "tenant_text_search" },
  ],
  categories: [
    { key: { tenantId: 1, slug: 1 }, unique: true, name: "tenant_slug_unique" },
    { key: { tenantId: 1, sortOrder: 1 }, name: "tenant_sort" },
  ],
  inventory: [
    { key: { tenantId: 1, variantId: 1 }, unique: true, name: "tenant_variant_unique" },
    { key: { tenantId: 1, productId: 1 }, name: "tenant_product" },
    { key: { tenantId: 1, onHand: 1 }, name: "tenant_onhand" },
  ],
  stockMovements: [{ key: { tenantId: 1, variantId: 1, createdAt: -1 }, name: "tenant_variant_created" }],
  carts: [
    { key: { tenantId: 1, tokenHash: 1 }, unique: true, partialFilterExpression: { tokenHash: { $type: "string" } }, name: "tenant_token_unique" },
    { key: { tenantId: 1, customerId: 1 }, unique: true, partialFilterExpression: { customerId: { $type: "objectId" } }, name: "tenant_customer_unique" },
    { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "ttl" },
  ],
  customers: [
    { key: { tenantId: 1, email: 1 }, unique: true, name: "tenant_email_unique" },
    { key: { tenantId: 1, createdAt: -1 }, name: "tenant_created" },
  ],
  addresses: [{ key: { tenantId: 1, customerId: 1 }, name: "tenant_customer" }],
  orders: [
    { key: { tenantId: 1, orderNumber: 1 }, unique: true, name: "tenant_number_unique" },
    { key: { tenantId: 1, status: 1, createdAt: -1 }, name: "tenant_status_created" },
    { key: { tenantId: 1, customerId: 1, createdAt: -1 }, name: "tenant_customer_created" },
    { key: { tenantId: 1, createdAt: -1 }, name: "tenant_created" },
    { key: { status: 1, "reservation.status": 1, "reservation.expiresAt": 1 }, name: "reservation_expiry" },
  ],
  payments: [
    { key: { provider: 1, reference: 1 }, unique: true, name: "provider_reference_unique" },
    { key: { tenantId: 1, orderId: 1 }, name: "tenant_order" },
  ],
  refunds: [
    { key: { tenantId: 1, orderId: 1 }, name: "tenant_order" },
    { key: { tenantId: 1, idempotencyKey: 1 }, unique: true, name: "tenant_idem_unique" },
  ],
  shipments: [{ key: { tenantId: 1, orderId: 1 }, name: "tenant_order" }],
  discounts: [{ key: { tenantId: 1, code: 1 }, unique: true, name: "tenant_code_unique" }],
  reviews: [
    { key: { tenantId: 1, productId: 1, customerId: 1 }, unique: true, name: "tenant_product_customer_unique" },
    { key: { tenantId: 1, productId: 1, status: 1, createdAt: -1 }, name: "tenant_product_status" },
    { key: { tenantId: 1, status: 1, createdAt: -1 }, name: "tenant_status" },
  ],
  media: [
    { key: { tenantId: 1, createdAt: -1 }, name: "tenant_created" },
    { key: { status: 1, createdAt: 1 }, name: "status_created" },
    { key: { key: 1 }, unique: true, name: "key_unique" },
  ],
};

const objectId = { bsonType: "objectId" };
const date = { bsonType: "date" };
const nonNegLong = { bsonType: ["int", "long"], minimum: 0 };
const str = (max = 500) => ({ bsonType: "string", maxLength: max });

/**
 * Server-side JSON schema validators for the most critical collections. They act as a last line
 * of defence beneath Zod validation (moderate level so legacy documents can still be updated).
 */
export const VALIDATORS: Record<string, Record<string, unknown>> = {
  tenants: {
    bsonType: "object",
    required: ["slug", "name", "status", "ownerUserId", "createdAt", "updatedAt"],
    properties: {
      slug: { bsonType: "string", pattern: "^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$" },
      name: str(120),
      status: { enum: ["pending", "active", "suspended", "deleted"] },
      ownerUserId: objectId,
      createdAt: date,
      updatedAt: date,
    },
  },
  users: {
    bsonType: "object",
    required: ["email", "passwordHash", "status", "failedLoginCount", "createdAt"],
    properties: {
      email: { bsonType: "string", maxLength: 254 },
      passwordHash: { bsonType: "string", pattern: "^\\$argon2id\\$" },
      platformRole: { enum: ["super_admin", "platform_support"] },
      status: { enum: ["active", "disabled"] },
    },
  },
  memberships: {
    bsonType: "object",
    required: ["tenantId", "role", "status"],
    properties: {
      tenantId: objectId,
      role: { enum: ["owner", "manager", "catalog_manager", "order_manager", "support"] },
      status: { enum: ["invited", "active", "revoked"] },
    },
  },
  products: {
    bsonType: "object",
    required: ["tenantId", "name", "slug", "status", "variants", "priceMin"],
    properties: {
      tenantId: objectId,
      name: str(200),
      slug: { bsonType: "string", pattern: "^[a-z0-9-]{1,120}$" },
      status: { enum: ["draft", "active", "archived"] },
      priceMin: nonNegLong,
      variants: {
        bsonType: "array",
        minItems: 1,
        maxItems: 100,
        items: {
          bsonType: "object",
          required: ["_id", "sku", "price"],
          properties: {
            price: nonNegLong,
            salePrice: { bsonType: ["int", "long", "null"], minimum: 0 },
            sku: str(64),
          },
        },
      },
    },
  },
  inventory: {
    bsonType: "object",
    required: ["tenantId", "productId", "variantId", "onHand", "reserved"],
    properties: {
      tenantId: objectId,
      onHand: { bsonType: ["int", "long"] },
      reserved: nonNegLong,
    },
  },
  orders: {
    bsonType: "object",
    required: ["tenantId", "orderNumber", "status", "currency", "items", "subtotal", "total", "email"],
    properties: {
      tenantId: objectId,
      status: { enum: ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "partially_refunded", "refunded"] },
      currency: { bsonType: "string", pattern: "^[A-Z]{3}$" },
      subtotal: nonNegLong,
      discountTotal: nonNegLong,
      shippingTotal: nonNegLong,
      taxTotal: nonNegLong,
      total: nonNegLong,
      refundedTotal: nonNegLong,
      items: { bsonType: "array", minItems: 1, maxItems: 100 },
    },
  },
  payments: {
    bsonType: "object",
    required: ["tenantId", "orderId", "provider", "reference", "amount", "currency", "status"],
    properties: {
      tenantId: objectId,
      amount: nonNegLong,
      refundedAmount: nonNegLong,
      provider: { enum: ["mock", "paystack", "stripe"] },
      status: { enum: ["pending", "succeeded", "failed", "cancelled", "refunded", "partially_refunded"] },
    },
  },
  refunds: {
    bsonType: "object",
    required: ["tenantId", "orderId", "paymentId", "amount", "status"],
    properties: { tenantId: objectId, amount: { bsonType: ["int", "long"], minimum: 1 } },
  },
  customers: {
    bsonType: "object",
    required: ["tenantId", "email", "status"],
    properties: { tenantId: objectId, email: { bsonType: "string", maxLength: 254 } },
  },
  discounts: {
    bsonType: "object",
    required: ["tenantId", "code", "type", "value", "usageCount"],
    properties: {
      tenantId: objectId,
      code: { bsonType: "string", pattern: "^[A-Z0-9_-]{3,32}$" },
      type: { enum: ["percentage", "fixed", "free_shipping"] },
      value: nonNegLong,
      usageCount: nonNegLong,
    },
  },
};

export async function ensureIndexes(db?: Db): Promise<void> {
  const d = db ?? (await getDb());
  const existing = new Set((await d.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of Object.keys(INDEXES)) {
    const validator = VALIDATORS[name];
    if (!existing.has(name)) {
      await d.createCollection(name, validator ? { validator: { $jsonSchema: validator }, validationLevel: "moderate", validationAction: "error" } : {});
    } else if (validator) {
      await d.command({ collMod: name, validator: { $jsonSchema: validator }, validationLevel: "moderate", validationAction: "error" });
    }
    const specs = INDEXES[name];
    if (specs.length) await d.collection(name).createIndexes(specs);
  }
}
