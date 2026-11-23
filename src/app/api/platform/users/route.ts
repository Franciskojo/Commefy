import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { platformCollection } from "@/lib/db/collections";
import { getCurrentUser, requirePlatformStaff } from "@/lib/auth/context";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { invalidateAllUserSessions, createSession } from "@/lib/auth/session";
import { setSessionCookie, USER_SESSION_COOKIE } from "@/lib/auth/cookies";
import { recordAudit } from "@/lib/audit";
import { Errors, toPublicError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { guardRequest } from "@/lib/security/api-guard";
import type { PlatformRole, UserDoc } from "@/lib/db/types";

const VALID_PLATFORM_ROLES: readonly PlatformRole[] = ["super_admin", "platform_support"];

export async function GET() {
  try {
    await requirePlatformStaff("platform:tenant_read");
    const usersCol = await platformCollection("users");
    const users = await usersCol
      .find({ platformRole: { $exists: true } })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u._id.toHexString(),
        email: u.email,
        name: u.name,
        platformRole: u.platformRole,
        status: u.status,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await guardRequest(req, "platform-users", 5, 3600);
    const body = await req.json();

    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const platformRole = (body.platformRole || "super_admin") as PlatformRole;
    const discardInitialAdmin = Boolean(body.discardInitialAdmin);
    const defaultSeededEmail = (
      process.env.INITIAL_ADMIN_EMAIL || "admin@storeforge.io"
    ).toLowerCase().trim();
    let discardEmail: string | undefined =
      typeof body.discardEmail === "string"
        ? body.discardEmail.toLowerCase().trim()
        : discardInitialAdmin
        ? defaultSeededEmail
        : undefined;

    if (!email || !email.includes("@") || !name || !password) {
      throw Errors.validation("name, email, and password are required");
    }

    if (!VALID_PLATFORM_ROLES.includes(platformRole)) {
      throw Errors.validation(
        `Invalid platformRole. Must be one of: ${VALID_PLATFORM_ROLES.join(", ")}`,
      );
    }

    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      throw Errors.validation(pwdCheck.message);
    }

    const usersCol = await platformCollection("users");
    const superAdminCount = await usersCol.countDocuments({
      platformRole: "super_admin",
      status: "active",
    });

    const bootstrapSecret = getEnv().BOOTSTRAP_SECRET;
    const providedSecret =
      req.headers.get("x-bootstrap-secret") ||
      (typeof body.bootstrapSecret === "string" ? body.bootstrapSecret : "");
    const secretValid = Boolean(bootstrapSecret) && safeEqual(providedSecret, bootstrapSecret!);
    const bootstrapMode = secretValid;

    let actorUser = await getCurrentUser();
    if (!bootstrapMode) {
      const actor = await requirePlatformStaff("platform:user_manage");
      actorUser = actor.user;
    }

    const existing = await usersCol.findOne({ email });
    const now = new Date();
    const passwordHash = await hashPassword(password);

    let userId: ObjectId;
    if (existing) {
      userId = existing._id;
      await usersCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            name,
            passwordHash,
            platformRole,
            status: "active",
            failedLoginCount: 0,
            lockedUntil: undefined,
            updatedAt: now,
          },
        },
      );
    } else {
      userId = new ObjectId();
      const userDoc: UserDoc = {
        _id: userId,
        email,
        name,
        passwordHash,
        platformRole,
        status: "active",
        failedLoginCount: 0,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await usersCol.insertOne(userDoc);
    }

    // Optionally discard (delete) previous super_admin account(s) and revoke sessions
    let discardedAdminEmail: string | null = null;
    if (discardInitialAdmin) {
      const previousAdmins = await usersCol
        .find({ platformRole: "super_admin", email: { $ne: email } })
        .toArray();
      for (const oldAdmin of previousAdmins) {
        await invalidateAllUserSessions(oldAdmin._id);
        await usersCol.deleteOne({ _id: oldAdmin._id });
        discardedAdminEmail = oldAdmin.email;
      }
    } else if (discardEmail && discardEmail !== email) {
      const oldAdmin = await usersCol.findOne({ email: discardEmail });
      if (oldAdmin) {
        await invalidateAllUserSessions(oldAdmin._id);
        await usersCol.deleteOne({ _id: oldAdmin._id });
        discardedAdminEmail = discardEmail;
      }
    }

    // Only the bootstrap flow signs the caller in as the new admin. Authenticated callers keep
    // their own session so creating another admin never swaps their login.
    let token: string | undefined;
    if (bootstrapMode) {
      const ip = req.headers.get("x-forwarded-for") || undefined;
      const userAgent = req.headers.get("user-agent") || undefined;
      const created = await createSession({ subject: "user", userId, userAgent, ip });
      token = created.token;
      await setSessionCookie(USER_SESSION_COOKIE, created.token, created.session.expiresAt);
    }

    await recordAudit({
      category: "platform",
      action: "platform_user.created",
      outcome: "success",
      actor: {
        type: actorUser ? "user" : "system",
        id: (actorUser?._id ?? userId).toHexString(),
        email: actorUser?.email ?? email,
      },
      target: { type: "user", id: userId.toHexString() },
      metadata: { email, platformRole, discardedAdminEmail },
    });

    return NextResponse.json(
      {
        success: true,
        sessionToken: token,
        discardedAdmin: discardedAdminEmail,
        user: {
          id: userId.toHexString(),
          email,
          name,
          platformRole,
          status: "active",
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requirePlatformStaff("platform:user_manage");
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

    if (!email) {
      throw Errors.validation("email of the platform user to delete is required");
    }

    if (email === actor.user.email) {
      throw Errors.validation(
        "Cannot delete the currently logged-in super_admin account. Log in with your new super_admin account first.",
      );
    }

    const usersCol = await platformCollection("users");
    const target = await usersCol.findOne({ email });
    if (!target) {
      throw Errors.notFound(`User ${email} not found`);
    }

    await invalidateAllUserSessions(target._id);
    await usersCol.deleteOne({ _id: target._id });

    await recordAudit({
      category: "platform",
      action: "platform_user.deleted",
      outcome: "success",
      actor: { type: "user", id: actor.user._id.toHexString(), email: actor.user.email },
      target: { type: "user", id: target._id.toHexString() },
      metadata: { deletedEmail: email },
    });

    return NextResponse.json({
      success: true,
      deletedEmail: email,
    });
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}
