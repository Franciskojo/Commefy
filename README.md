# StoreForge — Enterprise Multi-Tenant E-Commerce SaaS Platform

StoreForge is a production-grade, multi-tenant e-commerce platform engineered with strict data isolation, server-authoritative financial calculation, real-time atomic inventory reservation, and multi-gateway payment rails (Paystack, Stripe, and Mock Gateway).

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript 5 (Strict Mode)**, **Tailwind CSS v4**, and **MongoDB**.

---

## 1. Key Architectural Features

- **Strict Multi-Tenant Isolation**: Four-layer boundary defense preventing cross-tenant data leakage (Proxy routing, Server Actor Contexts, `TenantScopedCollection` query injector, and compound unique database indexes).
- **Server-Authoritative Quote Engine**: Integers in minor units (cents/kobo), round-half-up basis point (bps) math, coupon validation, shipping zone tiers, and largest-remainder line-item discount allocation.
- **Real-Time Atomic Inventory Locking**: MongoDB atomic filter-and-increment reservation engine prevents overselling during flash drops. Background cron (`/api/cron/jobs`) automatically sweeps unfulfilled holds after 30 minutes.
- **Authentication & Security Hardening**:
  - OWASP Argon2id password hashing with dummy verification timing attack neutralizer.
  - RFC 6238 TOTP two-factor authentication with 10 single-use emergency recovery keys.
  - Cryptographic session engine stored as SHA-256 token hashes with immediate server-side revocation on password or role change.
  - AES-256-GCM envelope encryption with tenant-bound Associated Authenticated Data (AAD) for payment secrets.
- **Unified Multi-Gateway Payment Stack**:
  - **Paystack**: African & international debit/credit cards, mobile money, and USSD.
  - **Stripe**: Global card processing, Apple Pay, Google Pay, and billing subscriptions.
  - **StoreForge Mock Gateway**: Deterministic test gateway simulating instant success, failure, and HMAC-signed webhook delivery.
- **Three-Tier User & Admin Portals**:
  1. **Public Consumer Storefronts** (`/store/[slug]`): Fast, responsive catalog, real-time cart drawer, express checkout, customer accounts, and order tracking.
  2. **Merchant Admin Dashboard** (`/admin/[tenantSlug]`): Products and variants manager, inventory adjustments, orders fulfillment, staff invites, and encrypted payment keys.
  3. **Platform Super-Admin Console** (`/platform`): Tenant registry, instant store freeze/suspension kill switch, security audit viewer, and runtime feature flags.

---

## 2. Directory Structure

```
├── docs/                     # Architectural specs, ADRs, database schema, security model
│   ├── architecture.md       # High-level architecture, tenant isolation, and ADRs
│   ├── database.md           # 26-collection schema, indexing, and sharding guide
│   ├── security.md           # Threat model, Argon2id, AES-256-GCM, and webhook security
│   └── checklist.md          # Implementation deliverables checklist
├── scripts/
│   ├── db-init.ts            # Index verification, schema constraints, and plans bootstrap
│   └── seed.ts               # Reference demo stores seed ("Apex Gear" & "Luxe Apparel")
├── src/
│   ├── app/
│   │   ├── admin/[tenantSlug]# Merchant backoffice (overview, products, orders, settings, staff, payments)
│   │   ├── api/
│   │   │   ├── cron/jobs     # Automated reservation cleanup cron
│   │   │   └── webhooks/     # Cryptographically verified gateway webhooks (Paystack, Stripe, Mock)
│   │   ├── auth/             # Staff login, store registration, MFA verification, logout
│   │   ├── platform/         # Super-admin control plane (tenants, audit logs, feature flags)
│   │   └── store/[slug]/     # Consumer storefront (catalog, detail, cart, checkout, account, orders)
│   ├── components/
│   │   ├── storefront/       # CartContext, CartDrawer, Header, Footer, ProductCard
│   │   └── ui/               # Badge, Button, Card, Input component library
│   ├── features/             # Core domain logic (cart, checkout, customers, inventory, orders, products, staff, subscriptions, tenants)
│   ├── lib/
│   │   ├── auth/             # Context guards, cookies, password (Argon2id), permissions, sessions, TOTP
│   │   ├── db/               # MongoClient singleton, typed collections, scoped wrapper, indexes, transactions
│   │   ├── payments/         # Payment adapters (Mock, Paystack, Stripe) and HMAC verification
│   │   ├── security/         # AES-256-GCM crypto, rate limiting, HTML/slug sanitization
│   │   ├── env.ts            # Zod-validated environment schema
│   │   ├── logger.ts         # Structured JSON logger with credential redaction
│   │   └── money.ts          # Integer minor-unit calculations and currency formats
│   └── proxy.ts              # Next.js 16 Host routing and security proxy
└── tests/
    ├── integration/security/ # Cross-tenant data isolation and authorization tests
    └── unit/                 # Financial math, crypto, TOTP, Argon2id, and sanitization tests
```

---

## 3. Getting Started

### Prerequisites
- Node.js 20+ (Node 24 tested)
- MongoDB 6.0+ (Local instance or MongoDB Atlas cluster)

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd Focus
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   *(Ensure `MONGODB_URI`, `AUTH_SECRET`, and `DATA_ENCRYPTION_KEY` are populated)*.

3. **Initialize Database Indexes & Schemas**:
   ```bash
   npm run db:init
   ```
   *Creates all 26 collections, compound tenant indexes, TTL indexes, subscription plans, and initial super-admin account.*

4. **Seed Reference Demo Stores**:
   ```bash
   npm run db:seed
   ```
   *Provisions "Apex Gear" and "Luxe Apparel" with technical products, variant attributes, stock movements, and test gateway configs.*

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Access the portal at `http://localhost:3000`.

---

## 4. Default Seed Accounts & Credentials

| Role | Portal URL | Email | Password |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `/platform` | `admin@storeforge.io` | `SuperSecretPassword123!` |
| **Apex Gear Merchant** | `/admin/apex-gear` | `marcus@apexgear.io` | `Password123!` |
| **Apex Gear Customer** | `/store/apex-gear/account`| `customer@apexgear.io` | `CustomerPassword123!` |
| **Luxe Apparel Merchant**| `/admin/luxe-apparel` | `helena@luxeapparel.io` | `Password123!` |

---

## 5. Verification & Test Suite

Run the full automated test suite (58+ unit and integration security tests):
```bash
npm test
```

Run TypeScript strict-mode compiler check:
```bash
npm run typecheck
```

Run production bundle build:
```bash
npm run build
```

---

## 6. License
Commercial Proprietary. Engineered for high-scale multi-tenant commerce operations.
