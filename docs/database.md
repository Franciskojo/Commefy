# StoreForge Database Specification & Architecture

## 1. Overview & Isolation Model

StoreForge uses a shared-database, tenant-partitioned MongoDB architecture. Physical infrastructure is consolidated into a single MongoDB replica set or sharded cluster while logical separation is strictly enforced through a four-tier isolation model:

1. **Routing & Context Boundary**: The edge proxy (`src/proxy.ts`) strips spoofed internal headers and routes incoming subdomains and verified custom domains to `/store/[slug]`.
2. **Actor Context Resolution**: Server-side contexts (`requireTenantStaff`, `requireCustomer`) verify session tokens against database sessions and validate memberships.
3. **Data Access Wrapper (`TenantScopedCollection`)**:
   - Injects `{ tenantId }` into every query filter, update filter, insert document, and aggregation match stage.
   - Forbids updates modifying `tenantId`.
   - Rejects aggregation stages that could traverse collection boundaries (`$lookup`, `$unionWith`, `$graphLookup`, `$out`, `$merge`).
4. **Compound Unique Database Indexes**:
   - Every tenant collection index prefixes `tenantId` (e.g. `{ tenantId: 1, sku: 1 }`, `{ tenantId: 1, slug: 1 }`).
   - Prevents cross-tenant uniqueness collisions and prevents unscoped full-collection scans.

---

## 2. Platform vs. Tenant Collection Hierarchy

The database schema is partitioned into **Platform Collections** (global SaaS metadata, accounts, system logs) and **Tenant Collections** (store-scoped catalog, orders, and customer data).

### Platform Collections (Global)

| Collection | Primary Key | Description |
| :--- | :--- | :--- |
| `users` | `ObjectId` | Platform operators, merchant owners, and invited store staff members. |
| `tenants` | `ObjectId` | Registered store organizations, subdomain slugs, custom domains, and operational status. |
| `sessions` | `string` (SHA-256 token hash) | Ephemeral session tokens with sliding idle expiration and MFA verification state. |
| `subscriptionPlans` | `string` (`free`, `pro`, `enterprise`) | Tiered pricing, resource quotas (max products, staff seats), and feature flags. |
| `subscriptions` | `ObjectId` | Active store subscriptions, trial dates, Stripe customer IDs, and status. |
| `featureFlags` | `string` | System-wide runtime toggles and kill switches. |
| `auditLogs` | `ObjectId` | Tamper-evident administrative and security audit trail. |
| `devEmails` | `ObjectId` | Development sink capturing transactional emails when `EMAIL_PROVIDER=log`. |
| `mediaAssets` | `ObjectId` | Local binary image store when running without cloud object storage. |

### Tenant-Owned Collections (Partitioned by `tenantId`)

| Collection | Compound Unique / Primary Index | Description |
| :--- | :--- | :--- |
| `storeSettings` | `{ tenantId: 1 }` (unique) | Store identity, currency, primary branding colors, contact info, shipping zones, and tax rules. |
| `memberships` | `{ tenantId: 1, userId: 1 }` (unique) | Staff RBAC bindings associating users with roles (`owner`, `manager`, `catalog_manager`, `order_manager`, `support`). |
| `invitations` | `{ tenantId: 1, tokenHash: 1 }` (unique) | Pending staff invitations with expiring cryptographic invite tokens. |
| `categories` | `{ tenantId: 1, slug: 1 }` (unique) | Hierarchical product taxonomy and navigation collections. |
| `products` | `{ tenantId: 1, slug: 1 }` (unique) | Product catalog with attributes, image snapshots, and publishing status. |
| `productVariants` | `{ tenantId: 1, sku: 1 }` (unique) | Distinct sellable SKUs with variant option values and pricing. |
| `inventory` | `{ tenantId: 1, variantId: 1 }` (unique) | Real-time stock counters (`onHand`, `reserved`). Available stock = `onHand - reserved`. |
| `stockMovements` | `{ tenantId: 1, variantId: 1, createdAt: -1 }` | Immutable ledger of all stock adjustments, checkout reservations, releases, and fulfillment deductions. |
| `customers` | `{ tenantId: 1, email: 1 }` (unique) | Storefront consumer accounts with Argon2id credentials and lockout counters. |
| `carts` | `{ tenantId: 1, tokenHash: 1 }` / `{ tenantId: 1, customerId: 1 }` | Anonymous and authenticated shopping carts with 30-day TTL. |
| `orders` | `{ tenantId: 1, orderNumber: 1 }` (unique) | Completed customer orders with immutable item snapshots, pricing lines, and delivery state. |
| `discounts` | `{ tenantId: 1, code: 1 }` (unique) | Percentage, fixed, and free-shipping promotional coupons with usage limits. |
| `paymentConfigs` | `{ tenantId: 1 }` (unique) | Gateway credentials encrypted with AES-256-GCM using tenant-bound AAD. |
| `payments` | `{ tenantId: 1, reference: 1 }` (unique) | Payment attempt records, gateway references, and transaction IDs. |
| `webhookEvents` | `{ provider: 1, eventId: 1 }` (unique) | Idempotency log for Stripe, Paystack, and Mock gateway webhooks. |
| `reviews` | `{ tenantId: 1, productId: 1, customerId: 1 }` | Verified buyer product reviews and star ratings. |

---

## 3. Financial Precision & Money Representations

Floating-point numbers (`double` or `float`) are strictly forbidden for currency and financial calculations:
- **Integer Minor Units**: All monetary values (`unitPrice`, `subtotal`, `taxTotal`, `total`) are stored as safe integers representing minor currency units (e.g., $19.99 is stored as `1999`, €250.00 as `25000`, ₦5,000 as `500000`).
- **Basis Points (bps)**: Percentages for discounts, shipping surcharges, and sales taxes are stored in basis points (1 bps = 0.01%, 10,000 bps = 100%).
- **Round-Half-Up Math**: Rates and taxes are calculated using integer multiplication and rounded half-up (`(amount * bps + 5000) / 10000`).
- **Largest Remainder Allocation**: Order-level discounts are distributed proportionally across item lines using the Hamilton-Hare largest remainder method, ensuring the sum of line items matches the order total to the exact penny.

---

## 4. Concurrency & Real-Time Inventory Locking

To guarantee that inventory cannot oversell during high-volume drops or concurrent checkouts:
1. **Atomic Reservation Filter**:
   ```ts
   await db.inventory.updateOne(
     {
       variantId: item.variantId,
       $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, item.quantity] }
     },
     {
       $inc: { reserved: item.quantity },
       $set: { updatedAt: new Date() }
     }
   );
   ```
2. **Checkout Window & Reservation Expiry**:
   - Cart reservations hold inventory for a configurable window (default 30 minutes).
   - If payment is not confirmed within the window, the background sweep job (`/api/cron/jobs`) releases the reserved count back to available stock.
3. **Commit on Payment Confirmation**:
   - Upon verified webhook arrival, the reservation is committed: `onHand` decreases by `quantity` and `reserved` decreases by `quantity`.
   - An immutable `StockMovementDoc` with reason `order_committed` is appended.

---

## 5. Sharding & Scaling Strategy

For enterprise deployments scaling beyond a single replica set:
- **Tenant Shard Key**: Collections are sharded using a hashed compound shard key `{ tenantId: "hashed", _id: 1 }`.
- **Colocation**: All data belonging to a single merchant routes to the same shard chunk, ensuring multi-document ACID transactions within a store execute locally without two-phase commit overhead across shards.
