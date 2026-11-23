import "server-only";
import { z } from "zod";

/**
 * Centralised, validated server configuration.
 *
 * Parsed lazily on first access (so `next build` can analyse modules without secrets) and
 * eagerly at server start via `src/instrumentation.ts`, which makes misconfiguration fail fast.
 * Never import this module from client components – it is guarded by `server-only`.
 */

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const base64Key32 = z
  .string()
  .refine((v) => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "must be a base64-encoded 32-byte key (openssl rand -base64 32)");

function cleanDomain(val?: string): string {
  let s = (val || "").trim();
  s = s.replace(/^["']+|["']+$/g, "").trim();
  if (s.includes("://")) {
    try {
      return new URL(s).host.toLowerCase();
    } catch {
      // ignore
    }
  }
  s = s.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim().toLowerCase();
  return s;
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || !val.trim()) {
          const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
          return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
        }
        const s = val.trim().replace(/^["']+|["']+$/g, "").trim();
        return s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
      })
      .pipe(z.url()),
    PLATFORM_ROOT_DOMAIN: z
      .string()
      .optional()
      .transform((val) => {
        if (!val || !val.trim()) {
          const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
          return vercelUrl ? cleanDomain(vercelUrl) : "localhost:3000";
        }
        return cleanDomain(val);
      })
      .pipe(z.string().regex(/^[a-z0-9.-]+(:\d{2,5})?$/, "lowercase host[:port] without scheme")),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must be a MongoDB connection string"),
    MONGODB_DB: z.string().min(1).default("storeforge"),
    MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(200).default(10),

    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    DATA_ENCRYPTION_KEY: base64Key32,
    DATA_ENCRYPTION_KEY_ID: z.string().min(1).default("k1"),
    /** Optional previous key for rotation: "<keyId>:<base64key>" */
    DATA_ENCRYPTION_PREVIOUS_KEYS: z.string().optional(),

    REQUIRE_PLATFORM_MFA: bool.optional(),

    EMAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
    EMAIL_FROM: z.string().min(3).default("StoreForge <no-reply@localhost>"),
    RESEND_API_KEY: z.string().optional(),

    STORAGE_PROVIDER: z.enum(["mongo", "cloudinary"]).default("mongo"),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(1024).max(20_000_000).default(5_000_000),

    PAYMENTS_ALLOW_MOCK: bool.optional(),
    MOCK_PAYMENT_SECRET: z.string().min(16).default("mock_payment_hmac_secret_key_32_chars_dev"),

    BILLING_PROVIDER: z.enum(["manual", "stripe"]).default("manual"),
    STRIPE_BILLING_SECRET_KEY: z.string().optional(),
    STRIPE_BILLING_WEBHOOK_SECRET: z.string().optional(),

    RATE_LIMIT_ENABLED: bool.optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    CRON_SECRET: z.string().min(16).optional(),
    /** One-time secret authorising unauthenticated first-admin bootstrap via the REST API. */
    BOOTSTRAP_SECRET: z.string().min(24).optional(),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const prod = env.APP_ENV === "production";
    if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "required when EMAIL_PROVIDER=resend" });
    }
    if (env.STORAGE_PROVIDER === "cloudinary") {
      for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
        if (!env[k]) ctx.addIssue({ code: "custom", path: [k], message: "required when STORAGE_PROVIDER=cloudinary" });
      }
    }
    if (env.BILLING_PROVIDER === "stripe") {
      for (const k of ["STRIPE_BILLING_SECRET_KEY", "STRIPE_BILLING_WEBHOOK_SECRET"] as const) {
        if (!env[k]) ctx.addIssue({ code: "custom", path: [k], message: "required when BILLING_PROVIDER=stripe" });
      }
    }
    if (prod) {
      if (env.PAYMENTS_ALLOW_MOCK) {
        ctx.addIssue({ code: "custom", path: ["PAYMENTS_ALLOW_MOCK"], message: "mock payments cannot be enabled in production" });
      }
      if (!env.APP_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "must use https in production" });
      }
      if (!env.CRON_SECRET) {
        ctx.addIssue({ code: "custom", path: ["CRON_SECRET"], message: "required in production" });
      }
      if (env.EMAIL_PROVIDER === "log") {
        ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "log provider is not allowed in production" });
      }
      if (env.BILLING_PROVIDER === "manual") {
        ctx.addIssue({ code: "custom", path: ["BILLING_PROVIDER"], message: "manual billing is not allowed in production" });
      }
    }
  });

export type Env = z.infer<typeof schema> & {
  isProduction: boolean;
  isTest: boolean;
  secureCookies: boolean;
  requirePlatformMfa: boolean;
  rateLimitEnabled: boolean;
  allowMockPayments: boolean;
};

let cached: Env | undefined;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and messages – never values.
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new ConfigError(`Invalid server configuration:\n${details}`);
  }
  const e = parsed.data;
  const isProduction = e.APP_ENV === "production";
  cached = {
    ...e,
    isProduction,
    isTest: e.APP_ENV === "test" || e.NODE_ENV === "test",
    secureCookies: e.APP_URL.startsWith("https://"),
    requirePlatformMfa: e.REQUIRE_PLATFORM_MFA ?? (isProduction || e.APP_ENV === "staging"),
    rateLimitEnabled: e.RATE_LIMIT_ENABLED ?? true,
    allowMockPayments: !isProduction && (e.PAYMENTS_ALLOW_MOCK ?? false),
  };
  return cached;
}

/** Test helper – resets the memoised environment. */
export function resetEnvCache(): void {
  cached = undefined;
}
