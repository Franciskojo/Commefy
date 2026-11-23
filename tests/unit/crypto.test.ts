import { describe, it, expect, beforeAll } from "vitest";
import {
  randomToken,
  sha256Hex,
  safeEqual,
  encryptSecret,
  decryptSecret,
  maskSecret,
  hashIp,
} from "@/lib/security/crypto";
import { resetEnvCache } from "@/lib/env";

describe("Cryptographic primitives and envelope encryption", () => {
  beforeAll(() => {
    process.env.APP_URL = "http://localhost:3000";
    process.env.PLATFORM_ROOT_DOMAIN = "localhost:3000";
    process.env.MONGODB_URI = "mongodb://localhost:27017/storeforge_test";
    process.env.AUTH_SECRET = "super-secret-auth-key-at-least-32-chars-long";
    // 32-byte key base64 encoded
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.DATA_ENCRYPTION_KEY_ID = "k1";
    resetEnvCache();
  });

  it("generates URL-safe random tokens of requested length", () => {
    const t1 = randomToken(32);
    const t2 = randomToken(32);
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes with SHA-256 hex correctly", () => {
    expect(sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("performs constant-time safe string comparisons", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("hashes IP addresses pseudonymously", () => {
    const h1 = hashIp("192.168.1.1");
    const h2 = hashIp("192.168.1.1");
    const h3 = hashIp("192.168.1.2");

    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(hashIp(undefined)).toBeUndefined();
  });

  it("encrypts and decrypts secrets with AES-256-GCM and binds to AAD", () => {
    const secret = "sk_live_very_secret_key_12345";
    const aad = "tenant:tenant-123:field:secretKey";

    const encrypted = encryptSecret(secret, aad);
    expect(encrypted.v).toBe(1);
    expect(encrypted.kid).toBe("k1");
    expect(encrypted.ct).toBeDefined();

    const decrypted = decryptSecret(encrypted, aad);
    expect(decrypted).toBe(secret);

    // Tampered AAD (e.g. attempting to decrypt another tenant's secret) fails authentication
    expect(() => decryptSecret(encrypted, "tenant:tenant-evil:field:secretKey")).toThrow();
  });

  it("masks secrets showing only last 4 characters", () => {
    expect(maskSecret("sk_live_123456789")).toBe("••••6789");
    expect(maskSecret("pass")).toBe("••••");
  });
});
