import "server-only";
import { ObjectId } from "mongodb";
import { tenantDb } from "@/lib/db/scoped";
import { hashPassword, verifyPassword, verifyDummyPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie, getCustomerCookieName } from "@/lib/auth/cookies";
import { Errors } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import type { CustomerDoc } from "@/lib/db/types";

export async function registerCustomer(params: {
  tenantId: ObjectId;
  email: string;
  password: string;
  name: string;
  marketingOptIn?: boolean;
  userAgent?: string;
  ip?: string;
}): Promise<{ customer: CustomerDoc; token: string }> {
  const db = await tenantDb(params.tenantId);
  const email = params.email.toLowerCase().trim();

  if (!email || !email.includes("@")) {
    throw Errors.validation("Valid email is required");
  }

  const pwdValidation = validatePasswordStrength(params.password);
  if (!pwdValidation.valid) {
    throw Errors.validation(pwdValidation.message);
  }

  const existing = await db.customers.findOne({ email });
  if (existing) {
    throw Errors.conflict("An account with this email already exists in this store");
  }

  const passwordHash = await hashPassword(params.password);
  const customerId = new ObjectId();
  const now = new Date();

  const customerDoc: CustomerDoc = {
    _id: customerId,
    tenantId: params.tenantId,
    email,
    name: params.name.trim(),
    passwordHash,
    status: "active",
    failedLoginCount: 0,
    wishlist: [],
    marketingOptIn: params.marketingOptIn ?? false,
    ordersCount: 0,
    totalSpent: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.customers.insertOne(customerDoc);

  const { token, session } = await createSession({
    subject: "customer",
    customerId,
    tenantId: params.tenantId,
    userAgent: params.userAgent,
    ip: params.ip,
  });

  const cookieName = getCustomerCookieName(params.tenantId);
  await setSessionCookie(cookieName, token, session.expiresAt);

  await recordAudit({
    tenantId: params.tenantId,
    category: "commerce",
    action: "customer.registered",
    outcome: "success",
    actor: { type: "customer", id: customerId.toHexString(), email },
    target: { type: "customer", id: customerId.toHexString() },
    ip: params.ip,
  });

  return { customer: customerDoc, token };
}

export async function loginCustomer(params: {
  tenantId: ObjectId;
  email: string;
  password: string;
  userAgent?: string;
  ip?: string;
}): Promise<{ customer: CustomerDoc; token: string }> {
  const db = await tenantDb(params.tenantId);
  const email = params.email.toLowerCase().trim();

  const customer = await db.customers.findOne({ email });
  if (!customer || !customer.passwordHash) {
    await verifyDummyPassword();
    throw Errors.unauthenticated("Invalid email or password");
  }

  if (customer.status === "disabled") {
    throw Errors.unauthenticated("Your account has been disabled. Please contact support.");
  }

  // Account lockout protection
  const now = new Date();
  if (customer.lockedUntil && customer.lockedUntil > now) {
    throw Errors.unauthenticated(
      "Account temporarily locked due to consecutive failed attempts. Please try again later.",
    );
  }

  const matches = await verifyPassword(params.password, customer.passwordHash);
  if (!matches) {
    const failedCount = (customer.failedLoginCount || 0) + 1;
    const lock = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : undefined;

    await db.customers.updateOne(
      { _id: customer._id },
      {
        $inc: { failedLoginCount: 1 },
        $set: { lockedUntil: lock, updatedAt: now },
      },
    );

    await recordAudit({
      tenantId: params.tenantId,
      category: "security",
      action: "customer.login_failed",
      outcome: "denied",
      actor: { type: "anonymous", email },
      ip: params.ip,
    });

    throw Errors.unauthenticated("Invalid email or password");
  }

  // Reset lockout counters and set last login
  await db.customers.updateOne(
    { _id: customer._id },
    {
      $set: {
        failedLoginCount: 0,
        lockedUntil: undefined,
        lastLoginAt: now,
        updatedAt: now,
      },
    },
  );

  const { token, session } = await createSession({
    subject: "customer",
    customerId: customer._id,
    tenantId: params.tenantId,
    userAgent: params.userAgent,
    ip: params.ip,
  });

  const cookieName = getCustomerCookieName(params.tenantId);
  await setSessionCookie(cookieName, token, session.expiresAt);

  await recordAudit({
    tenantId: params.tenantId,
    category: "commerce",
    action: "customer.login",
    outcome: "success",
    actor: { type: "customer", id: customer._id.toHexString(), email },
    ip: params.ip,
  });

  return { customer, token };
}
