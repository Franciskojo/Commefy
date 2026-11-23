import { NextResponse } from "next/server";
import { getSessionCookie, deleteSessionCookie, USER_SESSION_COOKIE } from "@/lib/auth/cookies";
import { invalidateSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const token = await getSessionCookie(USER_SESSION_COOKIE);
  if (token) {
    await invalidateSession(token);
    await deleteSessionCookie(USER_SESSION_COOKIE);
  }

  const url = new URL("/auth/login", request.url);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  return POST(request);
}
