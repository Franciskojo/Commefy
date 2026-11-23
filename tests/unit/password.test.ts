import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  validatePasswordStrength,
} from "@/lib/auth/password";

describe("Password hashing and validation", () => {
  it("enforces password strength requirements", () => {
    expect(validatePasswordStrength("short").valid).toBe(false);
    expect(validatePasswordStrength("allletters").valid).toBe(false);
    expect(validatePasswordStrength("12345678").valid).toBe(false);

    expect(validatePasswordStrength("ValidP@ssw0rd!").valid).toBe(true);
    expect(validatePasswordStrength("SecureStore2026").valid).toBe(true);
  });

  it("hashes password with Argon2id and verifies match", async () => {
    const plain = "SuperSecret123!";
    const hash = await hashPassword(plain);

    expect(hash).toMatch(/^\$argon2id\$/);

    const matches = await verifyPassword(plain, hash);
    expect(matches).toBe(true);

    const wrong = await verifyPassword("WrongPassword123!", hash);
    expect(wrong).toBe(false);
  });

  it("runs dummy verification without throwing", async () => {
    await expect(verifyDummyPassword()).resolves.toBeUndefined();
  });
});
