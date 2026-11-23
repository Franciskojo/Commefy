import "server-only";
import type { NextRequest } from "next/server";
import { assertRateLimit } from "@/lib/security/ratelimit";

/**
 * Best-effort client IP for rate limiting. Behind a trusted proxy (e.g. Vercel) the first
 * `x-forwarded-for` entry is the client address.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Per-IP rate limit for REST route handlers. Throws a RATE_LIMITED AppError (HTTP 429) when the
 * limit is exceeded; callers convert it with `toPublicError` in their catch block.
 */
export async function guardRequest(
  req: NextRequest,
  scope: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
  await assertRateLimit({
    key: `api:${scope}:${getClientIp(req)}`,
    max,
    windowSeconds,
    message: "Too many requests. Please slow down and try again later.",
  });
}
