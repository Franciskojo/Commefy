# Implementation checklist

Legend: [x] done & verified · [~] implemented with documented limitation · [ ] not done

## Phase 1 – Architecture
- [x] Architecture document (`docs/architecture.md`)
- [x] Threat model & mitigations (`docs/security.md`)
- [x] Database design (`docs/database.md`)

## Phase 2 – Foundation
- [x] Next.js App Router, TS strict, Tailwind, shadcn/ui, ESLint, Prettier
- [x] Environment validation (`src/lib/env.ts`)
- [x] MongoDB pooled client, typed collections, index/validator bootstrap
- [x] Tenant-scoped collection wrapper
- [x] Proxy host classification + server-side tenant resolution
- [x] Session auth, Argon2id, lockout, MFA (TOTP + recovery codes)
- [x] Permission map + `authorize()`
- [x] Error model, structured logger with redaction, correlation ids

## Phase 3 – Core platform
- [x] Tenant registration/onboarding
- [x] Memberships, invitations, staff removal
- [x] Platform admin area (tenants, plans, users, flags, audit, webhooks, jobs, health)
- [x] Audit logging

## Phase 4 – Commerce
- [x] Products, variants, categories, images, inventory + movements
- [x] Storefront pages
- [x] Customer accounts, carts (anon + merge), checkout, orders
- [x] Shipping zones, tax rules, discounts
- [x] Payment adapters (Paystack, Stripe, Mock) + webhooks
- [x] Refunds, shipments, reviews, wishlist, notifications

## Phase 5 – SaaS
- [x] Plans, subscriptions, entitlements & limit enforcement
- [x] Billing provider abstraction (Stripe Billing + manual)
- [x] Custom domains with DNS TXT verification, branding

## Phase 6 – Hardening
- [x] Rate limiting, security headers/CSP, upload validation, observability
- [x] Cross-tenant & payment security tests

## Phase 7 – Verification
- [x] lint, typecheck, unit, integration, e2e, build (see README "Verification")
