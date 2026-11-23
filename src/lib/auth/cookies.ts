import "server-only";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import type { ObjectId } from "mongodb";
import { idStr } from "@/lib/ids";

export const USER_SESSION_COOKIE = "sf_session";

export function getCustomerCookieName(tenantId: ObjectId | string): string {
  return `sf_c_${idStr(tenantId)}`;
}

export async function setSessionCookie(name: string, token: string, expiresAt: Date): Promise<void> {
  try {
    const cookieStore = await cookies();
    const env = getEnv();

    cookieStore.set({
      name,
      value: token,
      httpOnly: true,
      secure: env.secureCookies,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
  } catch (err) {
    // Only tolerate being called outside a Next.js request (CLI seed scripts, tests).
    // Any other failure must surface so a login never silently succeeds without a cookie.
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("outside a request scope")) throw err;
  }
}

export async function deleteSessionCookie(name: string): Promise<void> {
  const cookieStore = await cookies();
  const env = getEnv();

  cookieStore.set({
    name,
    value: "",
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionCookie(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}
