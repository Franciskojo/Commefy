import "server-only";
import { type ObjectId } from "mongodb";
import { getSessionCookie, USER_SESSION_COOKIE, getCustomerCookieName } from "./cookies";
import { validateSession } from "./session";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import type { CustomerDoc, PlatformRole, TenantRole, UserDoc } from "@/lib/db/types";
import { Errors } from "@/lib/errors";
import { hasTenantPermission, hasPlatformPermission, type Permission } from "./permissions";
import { getEnv } from "@/lib/env";

export interface StaffActor {
  type: "staff";
  user: UserDoc;
  tenantId: ObjectId;
  role: TenantRole;
  membershipId: ObjectId;
}

export interface PlatformActor {
  type: "platform";
  user: UserDoc;
  role: PlatformRole;
}

export interface CustomerActor {
  type: "customer";
  customer: CustomerDoc;
  tenantId: ObjectId;
}

export async function getCurrentUser(): Promise<UserDoc | null> {
  const token = await getSessionCookie(USER_SESSION_COOKIE);
  if (!token) return null;

  const session = await validateSession(token);
  if (!session || session.subject !== "user" || !session.userId) return null;

  const usersCol = await platformCollection("users");
  const user = await usersCol.findOne({ _id: session.userId });
  if (!user || user.status === "disabled") return null;

  return user;
}

export async function requireUser(): Promise<UserDoc> {
  const user = await getCurrentUser();
  if (!user) {
    throw Errors.unauthenticated("You must be logged in to access this resource");
  }
  return user;
}

export async function requirePlatformStaff(requiredPermission?: Permission): Promise<PlatformActor> {
  const token = await getSessionCookie(USER_SESSION_COOKIE);
  if (!token) throw Errors.unauthenticated("Platform administrator login required");

  const session = await validateSession(token);
  if (!session || session.subject !== "user" || !session.userId) {
    throw Errors.unauthenticated("Valid platform session required");
  }

  const usersCol = await platformCollection("users");
  const user = await usersCol.findOne({ _id: session.userId });
  if (!user || user.status === "disabled") {
    throw Errors.unauthenticated("Account disabled or not found");
  }

  if (!user.platformRole) {
    throw Errors.forbidden("Platform administrative privileges required");
  }

  const env = getEnv();
  // If MFA is enforced for platform users, ensure session is verified
  if (env.requirePlatformMfa && session.mfaPending) {
    throw Errors.mfaRequired();
  }

  if (requiredPermission && !hasPlatformPermission(user.platformRole, requiredPermission)) {
    throw Errors.forbidden(`Missing platform permission: ${requiredPermission}`);
  }

  return {
    type: "platform",
    user,
    role: user.platformRole,
  };
}

export async function requireTenantStaff(
  tenantId: ObjectId,
  requiredPermission?: Permission,
): Promise<StaffActor> {
  const user = await requireUser();

  const membershipsCol = await rawTenantCollection("memberships");
  const membership = await membershipsCol.findOne({
    tenantId,
    userId: user._id,
    status: "active",
  });

  if (!membership) {
    throw Errors.forbidden("You are not an authorized staff member for this store");
  }

  if (requiredPermission && !hasTenantPermission(membership.role, requiredPermission)) {
    throw Errors.forbidden(`You do not have permission: ${requiredPermission}`);
  }

  return {
    type: "staff",
    user,
    tenantId,
    role: membership.role,
    membershipId: membership._id,
  };
}

export async function getCurrentCustomer(tenantId: ObjectId): Promise<CustomerDoc | null> {
  const cookieName = getCustomerCookieName(tenantId);
  const token = await getSessionCookie(cookieName);
  if (!token) return null;

  const session = await validateSession(token);
  if (
    !session ||
    session.subject !== "customer" ||
    !session.customerId ||
    !session.tenantId ||
    !session.tenantId.equals(tenantId)
  ) {
    return null;
  }

  const customersCol = await rawTenantCollection("customers");
  const customer = await customersCol.findOne({ _id: session.customerId, tenantId });
  if (!customer || customer.status === "disabled") return null;

  return customer;
}

export async function requireCustomer(tenantId: ObjectId): Promise<CustomerActor> {
  const customer = await getCurrentCustomer(tenantId);
  if (!customer) {
    throw Errors.unauthenticated("Customer login required");
  }
  return {
    type: "customer",
    customer,
    tenantId,
  };
}
