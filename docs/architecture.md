# StoreForge — Architecture

StoreForge is a multi-tenant e-commerce SaaS platform built on Next.js (App Router), TypeScript
(strict), MongoDB (official Node.js driver) and Tailwind CSS / shadcn/ui.

## 1. High-level layout

```
Browser ──► Vercel edge ──► proxy.ts (host classification, rewrite, header hygiene, request id)
                              │
          ┌───────────────────┼─────────────────────────────┐
          ▼                   ▼                             ▼
   Platform host        Tenant subdomain              Verified custom domain
   example.com          store-a.example.com           www.store-a.com
   /, /signup, /login   rewritten → /store/store-a/*  rewritten → /store/~www.store-a.com/*
   /admin/[slug]/*      (storefront only)             (storefront only)
   /platform/*
   /store/[slug]/*  (platform-hosted fallback URL)
```

* `src/proxy.ts` never talks to the database (per Next.js guidance). It only classifies the
  `Host` header, strips spoofable internal headers (`x-sf-*`), attaches a correlation id and
  rewrites tenant hosts into the internal `/store/[tenantKey]` route tree.
* **The server re-validates the mapping**: `resolveStorefrontTenant()` (in
  `src/lib/tenant/resolve.ts`) recomputes the expected tenant key from the request host and
  rejects any mismatch. A request to `example.com/store/~evil.com` or `a.example.com/store/b`
  therefore resolves to *404*. Custom domains resolve only through `customDomains` documents with
  `status: "verified"`.
* Tenant status is validated on every resolution (`active` serves; `pending`/`suspended` render a
  "store unavailable" page; `deleted` is 404).

## 2. Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Presentation | `src/app`, `src/components` | Server components by default, client components for interactivity only. |
| Server actions / route handlers | `src/app/**/actions.ts`, `src/app/api/**/route.ts` | Parse input (Zod), call services, map errors. |
| Domain services | `src/features/*/service.ts` | Business rules, authorization (`authorize()`), transactions, audit. |
| Data access | `src/lib/db/*` | Connection pooling, typed collections, **tenant-scoped collection wrapper**. |
| Infrastructure | `src/lib/{payments,storage,email,security,auth,tenant}` | Provider adapters, crypto, rate limits, sessions. |

Business logic never lives in components. Every sensitive service function receives an
`ActorContext` produced on the server (`requireStaff`, `requireCustomer`, `requirePlatformUser`)
and re-checks authorization itself — middleware/proxy is **not** an authorization boundary.

## 3. Tenant isolation (defense in depth)

1. **Trusted resolution** – host → tenant via registry + verified domain mapping (§1).
2. **Authorization** – staff access requires an active `memberships` document for
   `(userId, tenantId)`, loaded fresh on every request; role → permission map in
   `src/lib/auth/permissions.ts`. Customers are tenant-scoped identities (`customers` collection);
   their sessions carry `tenantId` which must equal the resolved tenant.
3. **Query scoping** – tenant-owned collections are only reachable through
   `tenantCollection(tenantId, name)` (`src/lib/db/scoped.ts`) which injects `tenantId` into every
   filter, insert, update and aggregation `$match`, and refuses to let callers override it. An
   ESLint `no-restricted-imports` rule blocks the raw collection accessor outside `src/lib/db` and
   platform-level modules.
4. **Database constraints** – compound unique indexes start with `tenantId`
   (e.g. `{tenantId, slug}`, `{tenantId, email}`, `{tenantId, orderNumber}`).
5. **Cache keys** – `TenantCache` requires a tenant id and namespaces every key with it.
6. **Storage** – object keys are `tenants/<tenantId>/<random>`; deletes verify the `media`
   document's tenant.
7. **Tests** – `tests/integration/security/*.test.ts` cover the mandatory cross-tenant cases.

## 4. Identity, authentication and sessions

* **Users** (`users`) – staff, store owners, platform admins. Global identity, email unique.
* **Customers** (`customers`) – per-tenant identities (`{tenantId, email}` unique). A shopper of
  store A has no account in store B (mirrors Shopify-style isolation and avoids cross-store
  identity leakage).
* Passwords: Argon2id (`@node-rs/argon2`, m=19 MiB, t=2, p=1 — OWASP baseline).
* Sessions: opaque 256-bit random tokens in `HttpOnly`, `SameSite=Lax`, `Secure` (prod) cookies;
  only the SHA-256 of the token is stored in `sessions`. Idle and absolute expiry, sliding
  renewal, rotation on login/privilege change, revocation on password change / removal /
  suspension. Customer cookie names are tenant-specific (`sf_c_<tenantId>`).
* MFA: TOTP (RFC 6238, `@oslojs/otp`) with 10 single-use hashed recovery codes for users.
  Platform users must enrol MFA when `REQUIRE_PLATFORM_MFA=true` (default in production).
  Sensitive platform actions require re-authentication within 10 minutes.
* Brute force: per-account progressive lockout + per-IP and per-email rate limits; generic error
  messages; dummy hash verification to equalize timing for unknown accounts.
* CSRF: `SameSite=Lax` cookies + Next.js Server Action origin checks + an explicit `Origin`/`Host`
  check for all state-changing Route Handlers (`assertSameOrigin`). Webhooks are exempt and are
  authenticated by signatures.

### ADR-001: Custom session layer instead of Auth.js

Auth.js v5 is still published as a beta and its Credentials provider only supports JWT sessions,
which cannot be revoked server-side without extra infrastructure. The requirements (immediate
revocation on password change/staff removal/suspension, MFA step-up, lockout, re-auth for
sensitive actions, tenant-scoped customer identities) are met more directly by a small, audited
session module built on well-maintained primitives (`@node-rs/argon2`, `@oslojs/otp`, Node
`crypto`). The module follows the OWASP Session Management Cheat Sheet and the Lucia
(now educational) reference design. It is fully covered by unit and integration tests.

## 5. Authorization model

Platform roles (on `users.platformRole`): `super_admin`, `platform_support`.

Tenant roles (on `memberships.role`):

| Role | Intent |
| --- | --- |
| `owner` | Everything inside the tenant including billing, payments, staff, domains. |
| `manager` | Store operations (catalog, orders, refunds, discounts, customers, settings) — no payments credentials, billing, staff management or domains. |
| `catalog_manager` | Products, categories, images, pricing, inventory. |
| `order_manager` | Orders, fulfilment, shipments, returns/refunds requests. |
| `support` | Read customers and orders, add notes; no financial settings. |

The section of the specification listing tenant roles had missing headings; the five roles above
were inferred from the listed capabilities and are documented in `docs/security.md`.

Permissions are defined once in `src/lib/auth/permissions.ts` and checked by `authorize()`.

## 6. Commerce flows

* **Money** – integer minor units + ISO-4217 currency (`src/lib/money.ts`). All arithmetic is
  integer; percentages are basis points with banker-safe rounding (`Math.round` on integers).
* **Pricing** – `computeQuote()` is the single source of truth: loads products/variants from the
  DB, applies sale price, discount, shipping rules, and tax rules. Browser-supplied amounts are
  never read.
* **Checkout** – one MongoDB transaction: conditional inventory reservation
  (`onHand - reserved >= qty` unless backorders allowed), discount usage increment (conditional on
  limit), order insert with snapshots, payment insert, idempotency record. The payment provider is
  called after commit; failures are retryable from the order page. Unpaid reservations expire via
  the job runner (`/api/cron/jobs`) and are released.
* **Order state machine** – `src/features/orders/state-machine.ts`; every transition is a
  conditional update on the current status, making concurrent/duplicate events safe.
* **Payments** – `PaymentProvider` interface with `paystack`, `stripe`, and `mock` adapters.
  Orders become `paid` only via `confirmPayment()`, which re-verifies with the provider's server
  API, checks reference, amount, currency and order ownership, and uses a conditional status
  transition. Webhooks are signature-verified and recorded in `webhookEvents` with a unique
  `(provider, eventId)` index for idempotency.
* **SaaS billing** – a separate domain (`subscriptions`, `invoices`, `/api/webhooks/billing/*`)
  with a `BillingProvider` interface (`stripe` + `manual` for development).

## 7. Asynchronous work

`notificationJobs` holds queued jobs (emails, reservation expiry sweeps, upload cleanup). Jobs are
claimed atomically (`findOneAndUpdate` status `queued → running` with lease), retried with
exponential backoff, and dead-lettered after N attempts. They run from a Vercel Cron-triggered
route protected by `CRON_SECRET`, and opportunistically after enqueue.

## 8. Caching

Storefront pages are dynamically rendered (they depend on the request host). Tenant resolution
uses a short-TTL in-process cache keyed by normalized host and invalidated when tenant/domain
records change. No authenticated or personalized response is cached in shared caches;
`Cache-Control: private, no-store` is set on authenticated routes.

## 9. Key risks & mitigations (summary)

See `docs/security.md` for the full threat model.

| Risk | Mitigation |
| --- | --- |
| Cross-tenant leakage | Trusted host mapping, membership checks, scoped collections, compound indexes, tests |
| Payment manipulation | Server-side pricing, provider verification, amount/currency checks |
| Duplicate webhooks | Unique event ids, conditional transitions, idempotent refunds |
| Overselling | Conditional atomic reservation inside transactions |
| Account takeover | Argon2id, lockout, rate limits, MFA, session revocation |
| Malicious uploads | Size limit, magic-byte sniffing, re-encode via sharp, random keys |
| SSRF | No user-controlled outbound URLs; provider base URLs are constants; DNS-only domain checks |
| XSS | React escaping, no `dangerouslySetInnerHTML` for user content, strict CSP, sanitized colors |
