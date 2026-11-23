"use server";

import { getSessionCookie, USER_SESSION_COOKIE } from "@/lib/auth/cookies";
import { validateSession, markSessionMfaVerified } from "@/lib/auth/session";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { decryptSecret } from "@/lib/security/crypto";
import { verifyTotpCode, verifyAndConsumeRecoveryCode } from "@/lib/auth/totp";
import { Errors, toPublicError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { redirect } from "next/navigation";

export async function verifyMfaAction(_prevState: unknown, formData: FormData): Promise<{ error?: string }> {
  const code = (formData.get("code") as string)?.trim();
  const token = await getSessionCookie(USER_SESSION_COOKIE);

  if (!token) {
    return { error: "Session expired. Please sign in again." };
  }

  const session = await validateSession(token);
  if (!session || !session.userId) {
    return { error: "Invalid session. Please sign in again." };
  }

  const usersCol = await platformCollection("users");
  const user = await usersCol.findOne({ _id: session.userId });

  if (!user || !user.mfa?.enabled || !user.mfa.secretEnc) {
    return { error: "MFA is not enabled for this user account" };
  }

  let redirectUrl: string;

  try {
    const aad = `user:${user._id.toHexString()}:totp`;
    const secret = decryptSecret(user.mfa.secretEnc, aad);

    let isValid = verifyTotpCode(secret, code);

    if (!isValid && code.includes("-")) {
      // Attempt recovery code verification
      const recResult = verifyAndConsumeRecoveryCode(code, user.mfa.recoveryCodeHashes || []);
      if (recResult.valid) {
        isValid = true;
        await usersCol.updateOne(
          { _id: user._id },
          { $set: { "mfa.recoveryCodeHashes": recResult.remainingHashes, updatedAt: new Date() } },
        );
      }
    }

    if (!isValid) {
      await recordAudit({
        category: "security",
        action: "mfa.verify_failed",
        outcome: "denied",
        actor: { type: "user", id: user._id.toHexString(), email: user.email },
      });
      return { error: "Invalid authenticator code or recovery key" };
    }

    await markSessionMfaVerified(token);

    await recordAudit({
      category: "security",
      action: "mfa.verified",
      outcome: "success",
      actor: { type: "user", id: user._id.toHexString(), email: user.email },
    });

    if (user.platformRole) {
      redirectUrl = "/platform";
    } else {
      const membershipsCol = await rawTenantCollection("memberships");
      const membership = await membershipsCol.findOne({ userId: user._id, status: "active" });
      if (membership) {
        const tenantsCol = await platformCollection("tenants");
        const tenant = await tenantsCol.findOne({ _id: membership.tenantId });
        redirectUrl = tenant ? `/admin/${tenant.slug}` : "/auth/register";
      } else {
        redirectUrl = "/auth/register";
      }
    }
  } catch (err) {
    const pub = toPublicError(err);
    return { error: pub.body.message };
  }

  redirect(redirectUrl);
}
