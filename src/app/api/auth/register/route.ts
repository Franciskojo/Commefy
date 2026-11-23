import { NextRequest, NextResponse } from "next/server";
import { registerTenant } from "@/features/tenants/service";
import { toPublicError } from "@/lib/errors";
import { guardRequest } from "@/lib/security/api-guard";
import type { CurrencyCode } from "@/lib/money";

export async function POST(req: NextRequest) {
  try {
    await guardRequest(req, "auth-register", 5, 3600);
    const body = await req.json();
    const storeName = typeof body.storeName === "string" ? body.storeName.trim() : "";
    const desiredSlug = typeof body.desiredSlug === "string" ? body.desiredSlug.trim() || undefined : undefined;
    const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
    const ownerEmail = typeof body.ownerEmail === "string" ? body.ownerEmail.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const currency = (typeof body.currency === "string" ? body.currency : "USD") as CurrencyCode;

    if (!storeName || !ownerName || !ownerEmail || !password) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "storeName, ownerName, ownerEmail, and password are required",
          },
        },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const { tenant, user, sessionToken } = await registerTenant({
      storeName,
      desiredSlug,
      ownerName,
      ownerEmail,
      password,
      currency,
      ip,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        sessionToken,
        tenant: {
          id: tenant._id.toHexString(),
          slug: tenant.slug,
          name: tenant.name,
          status: tenant.status,
        },
        user: {
          id: user._id.toHexString(),
          email: user.email,
          name: user.name,
          role: "owner",
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}

