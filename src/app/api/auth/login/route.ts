import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/features/staff/service";
import { platformCollection, rawTenantCollection } from "@/lib/db/collections";
import { toPublicError } from "@/lib/errors";
import { guardRequest } from "@/lib/security/api-guard";

export async function POST(req: NextRequest) {
  try {
    await guardRequest(req, "auth-login", 10, 60);
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "email and password are required" } },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const { user, token, mfaRequired } = await loginUser({
      email,
      password,
      ip,
      userAgent,
    });

    const membershipsCol = await rawTenantCollection("memberships");
    const memberships = await membershipsCol
      .find({ userId: user._id, status: "active" })
      .toArray();

    const tenantsCol = await platformCollection("tenants");
    const tenantIds = memberships.map((m) => m.tenantId);
    const tenants =
      tenantIds.length > 0
        ? await tenantsCol.find({ _id: { $in: tenantIds } }).toArray()
        : [];
    const tenantMap = new Map(tenants.map((t) => [t._id.toHexString(), t]));

    return NextResponse.json({
      success: true,
      mfaRequired,
      sessionToken: token,
      user: {
        id: user._id.toHexString(),
        email: user.email,
        name: user.name,
        platformRole: user.platformRole || null,
        status: user.status,
      },
      memberships: memberships.map((m) => {
        const t = tenantMap.get(m.tenantId.toHexString());
        return {
          membershipId: m._id.toHexString(),
          tenantId: m.tenantId.toHexString(),
          tenantSlug: t?.slug,
          tenantName: t?.name,
          role: m.role,
          status: m.status,
        };
      }),
    });
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}
