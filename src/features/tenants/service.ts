import "server-only";
import { ObjectId } from "mongodb";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { withTransaction } from "@/lib/db/transaction";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { RESERVED_SLUGS, slugify, safeHexColor } from "@/lib/security/sanitize";
import { Errors } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie, USER_SESSION_COOKIE } from "@/lib/auth/cookies";
import { randomToken } from "@/lib/security/crypto";
import type { TenantDoc, UserDoc, StoreSettingsDoc, SubscriptionDoc } from "@/lib/db/types";
import type { CurrencyCode } from "@/lib/money";

export interface RegisterTenantInput {
  storeName: string;
  desiredSlug?: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  currency?: CurrencyCode;
  ip?: string;
  userAgent?: string;
}

export async function registerTenant(input: RegisterTenantInput): Promise<{
  tenant: TenantDoc;
  user: UserDoc;
  sessionToken: string;
}> {
  // 1. Validate inputs
  const email = input.ownerEmail.toLowerCase().trim();
  if (!email || !email.includes("@")) {
    throw Errors.validation("Valid email address is required");
  }

  const pwdValidation = validatePasswordStrength(input.password);
  if (!pwdValidation.valid) {
    throw Errors.validation(pwdValidation.message);
  }

  const baseSlug = slugify(input.desiredSlug || input.storeName);
  if (!baseSlug || baseSlug.length < 3) {
    throw Errors.validation("Store slug must be at least 3 alphanumeric characters");
  }

  if (RESERVED_SLUGS.has(baseSlug)) {
    throw Errors.validation("This store name/slug is reserved. Please pick another.");
  }

  const tenantsCol = await platformCollection("tenants");
  const existingTenant = await tenantsCol.findOne({ slug: baseSlug });
  if (existingTenant) {
    throw Errors.conflict("A store with this name or slug already exists");
  }

  const usersCol = await platformCollection("users");
  const existingUser = await usersCol.findOne({ email });
  if (existingUser) {
    throw Errors.conflict("An account with this email address already exists");
  }

  // 2. Prepare documents
  const userId = new ObjectId();
  const tenantId = new ObjectId();
  const membershipId = new ObjectId();
  const now = new Date();

  const passwordHash = await hashPassword(input.password);

  const userDoc: UserDoc = {
    _id: userId,
    email,
    name: input.ownerName.trim(),
    passwordHash,
    status: "active",
    failedLoginCount: 0,
    emailVerifiedAt: now, // Auto-verify initial owner in dev
    createdAt: now,
    updatedAt: now,
  };

  const tenantDoc: TenantDoc = {
    _id: tenantId,
    slug: baseSlug,
    name: input.storeName.trim(),
    status: "active",
    ownerUserId: userId,
    createdAt: now,
    updatedAt: now,
  };

  const storeSettingsDoc: StoreSettingsDoc = {
    _id: new ObjectId(),
    tenantId,
    storeName: input.storeName.trim(),
    currency: input.currency || "USD",
    locale: "en-US",
    branding: {
      primaryColor: "#4f46e5",
      accentColor: "#06b6d4",
    },
    contact: {
      email,
    },
    policies: {
      about: `Welcome to ${input.storeName}! We offer premium, handpicked products crafted with quality and care.`,
      privacy: "We respect your privacy and protect your personal data in accordance with modern security standards.",
      terms: "By purchasing from our store, you agree to our standard terms of service.",
      shippingReturns: "Standard shipping takes 3-5 business days. Returns accepted within 14 days of delivery.",
    },
    seo: {
      title: input.storeName,
      description: `Official online store for ${input.storeName}`,
    },
    checkout: {
      allowGuest: true,
      reservationMinutes: 30,
    },
    inventory: {
      allowBackorders: false,
      lowStockThreshold: 5,
    },
    shipping: {
      zones: [
        {
          id: "domestic",
          name: "Domestic Shipping",
          countries: ["US", "CA", "GB", "NG"],
          methods: [
            { id: "standard", name: "Standard Delivery", rate: 500, freeOver: 5000, minDays: 3, maxDays: 5 },
            { id: "express", name: "Express Delivery", rate: 1500, minDays: 1, maxDays: 2 },
          ],
        },
        {
          id: "international",
          name: "Worldwide Shipping",
          countries: ["*"],
          methods: [
            { id: "intl_standard", name: "International Tracked", rate: 2500, minDays: 7, maxDays: 14 },
          ],
        },
      ],
    },
    tax: {
      pricesIncludeTax: false,
      rules: [
        { id: "default_vat", name: "Standard Tax", country: "*", rateBps: 0, appliesToShipping: false },
      ],
    },
    createdAt: now,
    updatedAt: now,
  };

  const subscriptionDoc: SubscriptionDoc = {
    _id: new ObjectId(),
    tenantId,
    planId: "free",
    status: "active",
    interval: "month",
    provider: "manual",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 10), // 10 years free tier
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };

  // 3. Atomically persist user, tenant, membership, settings, and subscription
  await withTransaction(async (session) => {
    const rawMemberships = await rawTenantCollection("memberships");
    const rawSettings = await rawTenantCollection("storeSettings");
    const rawSubscriptions = await rawTenantCollection("subscriptions");

    await usersCol.insertOne(userDoc, { session });
    await tenantsCol.insertOne(tenantDoc, { session });

    await rawMemberships.insertOne(
      {
        _id: membershipId,
        tenantId,
        userId,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      { session },
    );

    await rawSettings.insertOne(storeSettingsDoc, { session });
    await rawSubscriptions.insertOne(subscriptionDoc, { session });
  });

  // 4. Create session and cookie
  const { token, session } = await createSession({
    subject: "user",
    userId,
    userAgent: input.userAgent,
    ip: input.ip,
  });

  await setSessionCookie(USER_SESSION_COOKIE, token, session.expiresAt);

  // 5. Audit log
  await recordAudit({
    tenantId,
    category: "admin",
    action: "tenant.created",
    outcome: "success",
    actor: { type: "user", id: userId.toHexString(), email },
    target: { type: "tenant", id: tenantId.toHexString() },
    metadata: { slug: baseSlug, storeName: input.storeName },
    ip: input.ip,
  });

  return {
    tenant: tenantDoc,
    user: userDoc,
    sessionToken: token,
  };
}

export async function updateStoreBranding(params: {
  tenantId: ObjectId;
  actorUserId: ObjectId;
  storeName?: string;
  tagline?: string;
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  policies?: {
    about?: string;
    privacy?: string;
    terms?: string;
    shippingReturns?: string;
  };
}): Promise<void> {
  const rawSettings = await rawTenantCollection("storeSettings");
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (params.storeName) updates["storeName"] = params.storeName.trim();
  if (params.tagline !== undefined) updates["tagline"] = params.tagline.trim();
  if (params.primaryColor) updates["branding.primaryColor"] = safeHexColor(params.primaryColor, "#4f46e5");
  if (params.accentColor) updates["branding.accentColor"] = safeHexColor(params.accentColor, "#06b6d4");
  if (params.logoUrl !== undefined) updates["branding.logoUrl"] = params.logoUrl;
  if (params.heroImageUrl !== undefined) updates["branding.heroImageUrl"] = params.heroImageUrl;

  if (params.contact) {
    if (params.contact.email !== undefined) updates["contact.email"] = params.contact.email.trim();
    if (params.contact.phone !== undefined) updates["contact.phone"] = params.contact.phone.trim();
    if (params.contact.address !== undefined) updates["contact.address"] = params.contact.address.trim();
  }

  if (params.policies) {
    if (params.policies.about !== undefined) updates["policies.about"] = params.policies.about.trim();
    if (params.policies.privacy !== undefined) updates["policies.privacy"] = params.policies.privacy.trim();
    if (params.policies.terms !== undefined) updates["policies.terms"] = params.policies.terms.trim();
    if (params.policies.shippingReturns !== undefined) updates["policies.shippingReturns"] = params.policies.shippingReturns.trim();
  }

  await rawSettings.updateOne({ tenantId: params.tenantId }, { $set: updates });

  await recordAudit({
    tenantId: params.tenantId,
    category: "admin",
    action: "branding.updated",
    outcome: "success",
    actor: { type: "user", id: params.actorUserId.toHexString() },
  });
}

export async function addCustomDomain(params: {
  tenantId: ObjectId;
  actorUserId: ObjectId;
  hostname: string;
}): Promise<{ domainId: ObjectId; verificationToken: string }> {
  const normHostname = params.hostname.toLowerCase().trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normHostname)) {
    throw Errors.validation("Invalid custom domain hostname (e.g. www.mystore.com)");
  }

  const customDomainsCol = await platformCollection("customDomains");
  const existing = await customDomainsCol.findOne({ hostname: normHostname });
  if (existing) {
    throw Errors.conflict("This domain is already mapped or registered by another store");
  }

  const verificationToken = `sf-verify-${randomToken(16)}`;
  const domainId = new ObjectId();

  await customDomainsCol.insertOne({
    _id: domainId,
    tenantId: params.tenantId,
    hostname: normHostname,
    status: "pending",
    verificationToken,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { domainId, verificationToken };
}

export async function verifyCustomDomain(params: {
  tenantId: ObjectId;
  domainId: ObjectId;
}): Promise<{ verified: boolean }> {
  const customDomainsCol = await platformCollection("customDomains");
  const domain = await customDomainsCol.findOne({ _id: params.domainId, tenantId: params.tenantId });
  if (!domain) throw Errors.notFound("Custom domain not found");

  // In production, would query DNS TXT records. For development/testing, activate on request.
  await customDomainsCol.updateOne(
    { _id: params.domainId },
    {
      $set: {
        status: "verified",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  return { verified: true };
}
