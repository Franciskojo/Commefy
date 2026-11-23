import "server-only";
import { ObjectId } from "mongodb";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { hashPassword, verifyPassword, verifyDummyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie, USER_SESSION_COOKIE } from "@/lib/auth/cookies";
import { Errors } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/service";
import { randomToken, sha256Hex } from "@/lib/security/crypto";
import { assertPlanLimit } from "@/features/subscriptions/service";
import type { TenantRole, UserDoc } from "@/lib/db/types";

export async function loginUser(params: {
  email: string;
  password: string;
  userAgent?: string;
  ip?: string;
}): Promise<{ user: UserDoc; token: string; mfaRequired: boolean }> {
  const usersCol = await platformCollection("users");
  const email = params.email.toLowerCase().trim();

  const user = await usersCol.findOne({ email });
  if (!user) {
    await verifyDummyPassword();
    throw Errors.unauthenticated("Invalid email or password");
  }

  if (user.status === "disabled") {
    throw Errors.unauthenticated("Your account has been deactivated. Please contact support.");
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw Errors.unauthenticated(
      "Account temporarily locked due to consecutive failed attempts. Please try again later.",
    );
  }

  const matches = await verifyPassword(params.password, user.passwordHash);
  if (!matches) {
    const failedCount = (user.failedLoginCount || 0) + 1;
    const lock = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : undefined;

    await usersCol.updateOne(
      { _id: user._id },
      {
        $inc: { failedLoginCount: 1 },
        $set: { lockedUntil: lock, updatedAt: now },
      },
    );

    await recordAudit({
      category: "security",
      action: "user.login_failed",
      outcome: "denied",
      actor: { type: "anonymous", email },
      ip: params.ip,
    });

    throw Errors.unauthenticated("Invalid email or password");
  }

  // Reset lockout count
  await usersCol.updateOne(
    { _id: user._id },
    {
      $set: {
        failedLoginCount: 0,
        lockedUntil: undefined,
        lastLoginAt: now,
        updatedAt: now,
      },
    },
  );

  const mfaRequired = user.mfa?.enabled ?? false;

  const { token, session } = await createSession({
    subject: "user",
    userId: user._id,
    mfaPending: mfaRequired,
    userAgent: params.userAgent,
    ip: params.ip,
  });

  await setSessionCookie(USER_SESSION_COOKIE, token, session.expiresAt);

  await recordAudit({
    category: "security",
    action: "user.login",
    outcome: "success",
    actor: { type: "user", id: user._id.toHexString(), email },
    ip: params.ip,
  });

  return { user, token, mfaRequired };
}

export async function inviteStaffMember(params: {
  tenantId: ObjectId;
  invitedByUserId: ObjectId;
  email: string;
  role: TenantRole;
}): Promise<{ invitationToken: string }> {
  // 1. Enforce SaaS Plan staff account limit
  await assertPlanLimit(params.tenantId, "staff");

  const email = params.email.toLowerCase().trim();
  const db = await tenantDb(params.tenantId);

  const existing = await db.memberships.findOne({
    $or: [{ invitedEmail: email }, { "user.email": email }],
    status: { $in: ["active", "invited"] },
  });

  if (existing) {
    throw Errors.conflict("A staff invitation or membership already exists for this email");
  }

  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  const membershipId = new ObjectId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const authTokensCol = await platformCollection("authTokens");
  await authTokensCol.insertOne({
    _id: tokenHash,
    type: "invite",
    tenantId: params.tenantId,
    membershipId,
    email,
    createdAt: now,
    expiresAt,
  });

  await db.memberships.insertOne({
    _id: membershipId,
    invitedEmail: email,
    role: params.role,
    status: "invited",
    invitedBy: params.invitedByUserId,
    createdAt: now,
    updatedAt: now,
  });

  await sendEmail({
    to: email,
    subject: "You've been invited to join a store team",
    text: `You have been invited to join the store management team as ${params.role}. Use your invitation link to complete setup: /auth/invite?token=${token}`,
  });

  await recordAudit({
    tenantId: params.tenantId,
    category: "admin",
    action: "staff.invited",
    outcome: "success",
    actor: { type: "user", id: params.invitedByUserId.toHexString() },
    target: { type: "user", id: email },
    metadata: { role: params.role },
  });

  return { invitationToken: token };
}

export async function removeStaffMember(params: {
  tenantId: ObjectId;
  actorUserId: ObjectId;
  membershipId: ObjectId;
}): Promise<void> {
  const db = await tenantDb(params.tenantId);
  const membership = await db.memberships.findOne({ _id: params.membershipId });

  if (!membership) throw Errors.notFound("Staff membership not found");
  if (membership.role === "owner") {
    throw Errors.forbidden("Store owner account cannot be removed");
  }

  await db.memberships.updateOne(
    { _id: params.membershipId },
    { $set: { status: "revoked", revokedAt: new Date() } },
  );

  // If user has an active session, invalidate sessions for security
  if (membership.userId) {
    const { invalidateAllUserSessions } = await import("@/lib/auth/session");
    await invalidateAllUserSessions(membership.userId);
  }

  await recordAudit({
    tenantId: params.tenantId,
    category: "admin",
    action: "staff.removed",
    outcome: "success",
    actor: { type: "user", id: params.actorUserId.toHexString() },
    target: { type: "membership", id: params.membershipId.toHexString() },
  });
}
