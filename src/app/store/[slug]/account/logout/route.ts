import { NextResponse } from "next/server";
import { resolveStorefrontTenant } from "@/lib/tenant/resolve";
import { getCustomerCookieName, getSessionCookie, deleteSessionCookie } from "@/lib/auth/cookies";
import { invalidateSession } from "@/lib/auth/session";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const tenant = await resolveStorefrontTenant(slug);

  const cookieName = getCustomerCookieName(tenant._id);
  const token = await getSessionCookie(cookieName);

  if (token) {
    await invalidateSession(token);
    await deleteSessionCookie(cookieName);
  }

  const url = new URL(`/store/${slug}`, request.url);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return POST(request, context);
}
