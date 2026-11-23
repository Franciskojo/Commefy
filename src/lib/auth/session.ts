import "server-only";
import { type ObjectId } from "mongodb";
import { platformCollection } from "@/lib/db/collections";
import type { SessionDoc, SessionSubject } from "@/lib/db/types";
import { randomToken, sha256Hex, hashIp } from "@/lib/security/crypto";

const USER_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 7; // 7 days idle
const USER_ABSOLUTE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 30; // 30 days absolute
const CUSTOMER_IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 30; // 30 days idle
const CUSTOMER_ABSOLUTE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 90; // 90 days absolute
const SLIDE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 2; // Slide if less than 2 days remaining on idle

export interface CreateSessionParams {
  subject: SessionSubject;
  userId?: ObjectId;
  customerId?: ObjectId;
  tenantId?: ObjectId;
  mfaPending?: boolean;
  userAgent?: string;
  ip?: string;
}

export async function createSession(params: CreateSessionParams): Promise<{ token: string; session: SessionDoc }> {
  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  const now = new Date();

  const isUser = params.subject === "user";
  const idleMs = isUser ? USER_IDLE_TIMEOUT_MS : CUSTOMER_IDLE_TIMEOUT_MS;
  const absMs = isUser ? USER_ABSOLUTE_TIMEOUT_MS : CUSTOMER_ABSOLUTE_TIMEOUT_MS;

  const sessionDoc: SessionDoc = {
    _id: tokenHash,
    subject: params.subject,
    userId: params.userId,
    customerId: params.customerId,
    tenantId: params.tenantId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + idleMs),
    absoluteExpiresAt: new Date(now.getTime() + absMs),
    mfaPending: params.mfaPending ?? false,
    userAgent: params.userAgent?.slice(0, 255),
    ipHash: hashIp(params.ip),
  };

  const col = await platformCollection("sessions");
  await col.insertOne(sessionDoc);

  return { token, session: sessionDoc };
}

export async function validateSession(token: string): Promise<SessionDoc | null> {
  if (!token || typeof token !== "string" || token.length < 16) return null;
  const tokenHash = sha256Hex(token);

  const col = await platformCollection("sessions");
  const session = await col.findOne({ _id: tokenHash });
  if (!session) return null;

  const now = new Date();
  if (now > session.expiresAt || now > session.absoluteExpiresAt) {
    await col.deleteOne({ _id: tokenHash });
    return null;
  }

  // Sliding idle window update
  const remainingIdle = session.expiresAt.getTime() - now.getTime();
  if (remainingIdle < SLIDE_THRESHOLD_MS) {
    const idleMs = session.subject === "user" ? USER_IDLE_TIMEOUT_MS : CUSTOMER_IDLE_TIMEOUT_MS;
    const newExpires = new Date(Math.min(now.getTime() + idleMs, session.absoluteExpiresAt.getTime()));
    await col.updateOne({ _id: tokenHash }, { $set: { lastSeenAt: now, expiresAt: newExpires } });
    session.expiresAt = newExpires;
    session.lastSeenAt = now;
  }

  return session;
}

export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = sha256Hex(token);
  const col = await platformCollection("sessions");
  await col.deleteOne({ _id: tokenHash });
}

export async function invalidateAllUserSessions(userId: ObjectId): Promise<void> {
  const col = await platformCollection("sessions");
  await col.deleteMany({ subject: "user", userId });
}

export async function invalidateAllCustomerSessions(tenantId: ObjectId, customerId: ObjectId): Promise<void> {
  const col = await platformCollection("sessions");
  await col.deleteMany({ subject: "customer", tenantId, customerId });
}

export async function markSessionMfaVerified(token: string): Promise<void> {
  const tokenHash = sha256Hex(token);
  const col = await platformCollection("sessions");
  await col.updateOne({ _id: tokenHash }, { $set: { mfaPending: false, reauthAt: new Date() } });
}

export async function updateSessionReauth(token: string): Promise<void> {
  const tokenHash = sha256Hex(token);
  const col = await platformCollection("sessions");
  await col.updateOne({ _id: tokenHash }, { $set: { reauthAt: new Date() } });
}
