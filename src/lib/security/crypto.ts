import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import type { EncryptedValue } from "@/lib/db/types";

/** 256-bit URL-safe random token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(algorithm: "sha256" | "sha512", key: string | Buffer, data: string | Buffer): string {
  return createHmac(algorithm, key).update(data).digest("hex");
}

/** Constant-time string comparison (returns false for length mismatch without early exit on content). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Pseudonymous IP hash for logs and rate-limit keys (keyed so it cannot be reversed by lookup tables). */
export function hashIp(ip: string | undefined | null): string | undefined {
  if (!ip) return undefined;
  return createHmac("sha256", getEnv().AUTH_SECRET).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

// ───────────────────────── Envelope encryption (AES-256-GCM) ─────────────────────────

function keyring(): Map<string, Buffer> {
  const env = getEnv();
  const ring = new Map<string, Buffer>();
  ring.set(env.DATA_ENCRYPTION_KEY_ID, Buffer.from(env.DATA_ENCRYPTION_KEY, "base64"));
  if (env.DATA_ENCRYPTION_PREVIOUS_KEYS) {
    for (const entry of env.DATA_ENCRYPTION_PREVIOUS_KEYS.split(",")) {
      const [kid, b64] = entry.split(":");
      if (kid && b64) {
        const k = Buffer.from(b64, "base64");
        if (k.length === 32) ring.set(kid.trim(), k);
      }
    }
  }
  return ring;
}

/**
 * Encrypts a secret (e.g. tenant payment keys, TOTP secrets) with AES-256-GCM. The key id is
 * stored alongside the ciphertext to support rotation. `aad` binds ciphertext to its context
 * (e.g. tenant id + field) so values cannot be swapped between tenants.
 */
export function encryptSecret(plaintext: string, aad: string): EncryptedValue {
  const env = getEnv();
  const key = Buffer.from(env.DATA_ENCRYPTION_KEY, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    v: 1,
    kid: env.DATA_ENCRYPTION_KEY_ID,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
}

export function decryptSecret(value: EncryptedValue, aad: string): string {
  const key = keyring().get(value.kid);
  if (!key) throw new Error(`Unknown encryption key id`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ct, "base64")), decipher.final()]).toString("utf8");
}

/** Shows only the last 4 characters of a secret for display purposes. */
export function maskSecret(secret: string): string {
  return secret.length <= 4 ? "••••" : `••••${secret.slice(-4)}`;
}
