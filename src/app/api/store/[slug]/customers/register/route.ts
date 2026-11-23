import { NextRequest, NextResponse } from "next/server";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { registerCustomer } from "@/features/customers/service";
import { toPublicError } from "@/lib/errors";
import { guardRequest } from "@/lib/security/api-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await guardRequest(req, "customer-register", 10, 3600);
    const { slug } = await params;
    const tenant = await resolveStorefrontTenant(slug);
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const marketingOptIn = Boolean(body.marketingOptIn);

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "name, email, and password are required",
          },
        },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const { customer, token } = await registerCustomer({
      tenantId: tenant._id,
      name,
      email,
      password,
      marketingOptIn,
      ip,
      userAgent,
    });

    return NextResponse.json(
      {
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
          marketingOptIn: customer.marketingOptIn,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const pub = toPublicError(err);
    return NextResponse.json({ error: pub.body }, { status: pub.status });
  }
}

