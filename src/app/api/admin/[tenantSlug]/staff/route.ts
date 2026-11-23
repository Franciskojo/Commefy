import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { platformCollection } from "@/lib/db/collections";
import { tenantDb } from "@/lib/db/scoped";
import { getCurrentUser, requireTenantStaff } from "@/lib/auth/context";
import { inviteStaffMember } from "@/features/staff/service";
import { assertPlanLimit } from "@/features/subscriptions/service";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { Errors, toPublicError } from "@/lib/errors";
import type { TenantRole, UserDoc } from "@/lib/db/types";
import { guardRequest } from "@/lib/security/api-guard";

const VALID_TENANT_ROLES: readonly TenantRole[] = [
  "owner",
  "manager",
  "catalog_manager",
  "order_manager",
  "support",
];

async function resolveAuthorizedActor(tenantId: ObjectId) {
  const user = await getCurrentUser();
  if (!user) {
    throw Errors.unauthenticated("You must be logged in to access this resource");
  }
  if (user.platformRole === "super_admin") {
    return user;
  }
  const staff = await requireTenantStaff(tenantId, "staff:invite");
  return staff.user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const tenantsCol = await platformCollection("tenants");
    const tenant = await tenantsCol.findOne({ slug: tenantSlug.toLowerCase() });
    if (!tenant) throw Errors.notFound("Store not found");

    const user = await getCurrentUser();
    if (!user) throw Errors.unauthenticated("Authentication required");
    if (user.platformRole !== "super_admin") {
      await requireTenantStaff(tenant._id, "staff:read");
    }

    const db = await tenantDb(tenant._id);
    const memberships = await db.memberships.find({}).toArray();
    const usersCol = await platformCollection("users");
    const userIds = memberships.map((m) => m.userId).filter((id): id is ObjectId => Boolean(id));
    const users =
      userIds.length > 0 ? await usersCol.find({ _id: { $in: userIds } }).toArray() : [];
    const userMap = new Map(users.map((u) => [u._id.toHexString(), u]));

    return NextResponse.json({
      success: true,
      tenant: { id: tenant._id.toHexString(), slug: tenant.slug, name: tenant.name },
      staff: memberships.map((m) => {
        const u = m.userId ? userMap.get(m.userId.toHexString()) : undefined;
        return {
          membershipId: m._id.toHexString(),
          userId: m.userId?.toHexString() || null,
          email: u?.email || m.invitedEmail || null,
          name: u?.name || null,
          role: m.role,
          status: m.status,
          createdAt: m.createdAt,
        };
      }),
    });
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    await guardRequest(req, "staff-create", 30, 3600);
    const { tenantSlug } = await params;
    const tenantsCol = await platformCollection("tenants");
    const tenant = await tenantsCol.findOne({ slug: tenantSlug.toLowerCase() });
    if (!tenant) throw Errors.notFound("Store not found");

    const actorUser = await resolveAuthorizedActor(tenant._id);
    const body = await req.json();

    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role as TenantRole;

    if (!email || !email.includes("@") || !role) {
      throw Errors.validation("email and role are required");
    }

    if (!VALID_TENANT_ROLES.includes(role)) {
      throw Errors.validation(`Invalid role. Must be one of: ${VALID_TENANT_ROLES.join(", ")}`);
    }

    // If password is omitted, fall back to standard invitation workflow
    if (!password) {
      const { invitationToken } = await inviteStaffMember({
        tenantId: tenant._id,
        invitedByUserId: actorUser._id,
        email,
        role,
      });

      return NextResponse.json(
        {
          success: true,
          mode: "invited",
          email,
          role,
          invitationToken,
        },
        { status: 201 },
      );
    }

    // Direct active staff account creation (ideal for Postman testing)
    await assertPlanLimit(tenant._id, "staff");

    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      throw Errors.validation(pwdCheck.message);
    }

    const usersCol = await platformCollection("users");
    let targetUser = await usersCol.findOne({ email });
    const now = new Date();
    const passwordHash = await hashPassword(password);

    if (!targetUser) {
      const newUserId = new ObjectId();
      const newUserDoc: UserDoc = {
        _id: newUserId,
        email,
        name: name || email.split("@")[0],
        passwordHash,
        status: "active",
        failedLoginCount: 0,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await usersCol.insertOne(newUserDoc);
      targetUser = newUserDoc;
    } else if (name || password) {
      await usersCol.updateOne(
        { _id: targetUser._id },
        {
          $set: {
            ...(name ? { name } : {}),
            passwordHash,
            status: "active",
            failedLoginCount: 0,
            lockedUntil: undefined,
            updatedAt: now,
          },
        },
      );
    }

    const db = await tenantDb(tenant._id);
    const existingMembership = await db.memberships.findOne({
      $or: [{ userId: targetUser._id }, { invitedEmail: email }],
    });

    let membershipId: ObjectId;
    if (existingMembership) {
      membershipId = existingMembership._id;
      await db.memberships.updateOne(
        { _id: existingMembership._id },
        {
          $set: {
            userId: targetUser._id,
            role,
            status: "active",
            acceptedAt: now,
            updatedAt: now,
          },
        },
      );
    } else {
      membershipId = new ObjectId();
      await db.memberships.insertOne({
        _id: membershipId,
        userId: targetUser._id,
        invitedEmail: email,
        role,
        status: "active",
        invitedBy: actorUser._id,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordAudit({
      tenantId: tenant._id,
      category: "admin",
      action: "staff.created",
      outcome: "success",
      actor: { type: "user", id: actorUser._id.toHexString(), email: actorUser.email },
      target: { type: "user", id: targetUser._id.toHexString() },
      metadata: { email, role },
    });

    return NextResponse.json(
      {
        success: true,
        mode: "active",
        tenant: {
          id: tenant._id.toHexString(),
          slug: tenant.slug,
          name: tenant.name,
        },
        staff: {
          membershipId: membershipId.toHexString(),
          userId: targetUser._id.toHexString(),
          email: targetUser.email,
          name: name || targetUser.name,
          role,
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

