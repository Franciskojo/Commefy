/**
 * Application error model. Services throw `AppError` subclasses; trust boundaries (route
 * handlers, server actions) convert them to safe client responses with `toPublicError`.
 * Unknown errors are logged server-side and returned as a generic 500 without details.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PLAN_LIMIT"
  | "TENANT_UNAVAILABLE"
  | "PAYMENT_ERROR"
  | "INSUFFICIENT_STOCK"
  | "INVALID_STATE"
  | "MFA_REQUIRED"
  | "REAUTH_REQUIRED"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PLAN_LIMIT: 402,
  TENANT_UNAVAILABLE: 403,
  PAYMENT_ERROR: 402,
  INSUFFICIENT_STOCK: 409,
  INVALID_STATE: 409,
  MFA_REQUIRED: 401,
  REAUTH_REQUIRED: 401,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;
  readonly expose: boolean;

  constructor(code: ErrorCode, message: string, opts?: { fieldErrors?: Record<string, string[]>; expose?: boolean; cause?: unknown }) {
    super(message, { cause: opts?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = opts?.fieldErrors;
    this.expose = opts?.expose ?? code !== "INTERNAL_ERROR";
  }
}

export const Errors = {
  validation: (message = "Invalid input", fieldErrors?: Record<string, string[]>) =>
    new AppError("VALIDATION_ERROR", message, { fieldErrors }),
  unauthenticated: (message = "Authentication required") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission to perform this action") => new AppError("FORBIDDEN", message),
  notFound: (message = "Not found") => new AppError("NOT_FOUND", message),
  conflict: (message = "Conflict") => new AppError("CONFLICT", message),
  rateLimited: (message = "Too many requests. Please try again later.") => new AppError("RATE_LIMITED", message),
  planLimit: (message: string) => new AppError("PLAN_LIMIT", message),
  tenantUnavailable: (message = "This store is currently unavailable") => new AppError("TENANT_UNAVAILABLE", message),
  payment: (message = "Payment could not be processed") => new AppError("PAYMENT_ERROR", message),
  insufficientStock: (message = "Some items are no longer available in the requested quantity") =>
    new AppError("INSUFFICIENT_STOCK", message),
  invalidState: (message: string) => new AppError("INVALID_STATE", message),
  mfaRequired: () => new AppError("MFA_REQUIRED", "Multi-factor verification required"),
  reauthRequired: () => new AppError("REAUTH_REQUIRED", "Please confirm your password to continue"),
  internal: (cause?: unknown) => new AppError("INTERNAL_ERROR", "Something went wrong", { cause, expose: false }),
};

export interface PublicError {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function toPublicError(e: unknown, requestId?: string): { status: number; body: PublicError } {
  if (isAppError(e) && e.expose) {
    return {
      status: e.status,
      body: { code: e.code, message: e.message, fieldErrors: e.fieldErrors, requestId },
    };
  }

  // Always log the actual root error to server console for debugging
  console.error("[StoreForge Unhandled Error]:", e);

  const isDev = process.env.NODE_ENV !== "production";
  const errMessage = e instanceof Error ? e.message : String(e);

  if (
    errMessage.includes("ECONNREFUSED") ||
    errMessage.includes("Server selection timed out") ||
    errMessage.includes("connect")
  ) {
    return {
      status: 503,
      body: {
        code: "INTERNAL_ERROR",
        message: "Database connection failed. Please ensure MongoDB is running or configure MONGODB_URI in .env.local",
        requestId,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: "INTERNAL_ERROR",
      message: isDev ? errMessage || "Something went wrong. Please try again." : "Something went wrong. Please try again.",
      requestId,
    },
  };
}
