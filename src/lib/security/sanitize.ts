/**
 * Pure sanitisation helpers safe for both server and client.
 */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Only allow strict #RRGGBB colours – prevents CSS injection via tenant branding. */
export function safeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

export function slugify(input: string, max = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** Escape regex metacharacters for safe use of user input inside $regex. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Escape text for HTML email templates. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validates a post-login redirect target. Only same-site relative paths are accepted;
 * protocol-relative (`//evil.com`), backslash tricks and absolute URLs are rejected.
 */
export function safeRedirectPath(target: unknown, fallback = "/"): string {
  if (typeof target !== "string" || target.length === 0 || target.length > 512) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(target) || target.includes("\\")) return fallback;
  try {
    const u = new URL(target, "http://local.invalid");
    if (u.origin !== "http://local.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

/** Reserved subdomains / slugs that tenants may not claim. */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "platform", "dashboard", "store", "stores", "mail", "email", "smtp",
  "static", "assets", "cdn", "media", "help", "support", "status", "docs", "blog", "billing", "auth",
  "login", "signup", "register", "account", "accounts", "secure", "security", "webhooks", "internal",
  "test", "staging", "dev", "root", "system", "_next",
]);
