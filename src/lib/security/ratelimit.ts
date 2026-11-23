import "server-only";
import { platformCollection } from "@/lib/db/collections";
import { Errors } from "@/lib/errors";
import { getEnv } from "@/lib/env";

export interface RateLimitOptions {
  key: string;
  max: number;
  windowSeconds: number;
  message?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * MongoDB-backed atomic rate limiter with TTL auto-cleanup.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const env = getEnv();
  if (!env.rateLimitEnabled) {
    return {
      success: true,
      limit: options.max,
      remaining: options.max,
      resetAt: new Date(Date.now() + options.windowSeconds * 1000),
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + options.windowSeconds * 1000);
  const col = await platformCollection("rateLimits");

  const result = await col.findOneAndUpdate(
    { _id: options.key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt },
    },
    { upsert: true, returnDocument: "after" },
  );

  const count = result?.count ?? 1;
  const remaining = Math.max(0, options.max - count);
  const success = count <= options.max;

  return {
    success,
    limit: options.max,
    remaining,
    resetAt: result?.expiresAt ?? expiresAt,
  };
}

export async function assertRateLimit(options: RateLimitOptions): Promise<void> {
  const res = await checkRateLimit(options);
  if (!res.success) {
    throw Errors.rateLimited(options.message ?? "Too many requests. Please try again later.");
  }
}
