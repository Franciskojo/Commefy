import { NextRequest, NextResponse } from "next/server";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { loginCustomer } from "@/features/customers/service";
import { toPublicError } from "@/lib/errors";
import { guardRequest } from "@/lib/security/api-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await guardRequest(req, "customer-login", 10, 60);
    const { slug } = await params;
    const tenant = await resolveStorefrontTenant(slug);
    const body = await req.json();

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "email and password are required",
          },
        },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const { customer, token } = await loginCustomer({
      tenantId: tenant._id,
      email,
      password,
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      sessionToken: token,
      tenant: {
        id: tenant._id.toHexString(),
        slug: tenant.slug,
        name: tenant.name,
      },
      customer: {
        id: customer._id.toHexString(),
        email: customer.email,
        name: customer.name,
        status: customer.status,
      },
    });
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}

