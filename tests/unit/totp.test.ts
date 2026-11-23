import { describe, it, expect } from "vitest";
import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
} from "@/lib/auth/totp";

describe("TOTP MFA and recovery codes", () => {
  it("encodes and decodes base32 symmetrically", () => {
    const raw = Buffer.from("storeforge-totp-test-key-12345");
    const encoded = base32Encode(raw);
    const decoded = base32Decode(encoded);
    expect(decoded.toString()).toBe(raw.toString());
  });

  it("generates and verifies valid TOTP codes", () => {
    const secret = generateTotpSecret(20);
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);

    const isValid = verifyTotpCode(secret, code);
    expect(isValid).toBe(true);

    const isWrong = verifyTotpCode(secret, "000000");
    // Unless generated code happened to be 000000
    if (code !== "000000") {
      expect(isWrong).toBe(false);
    }
  });

  it("handles clock drift within window", () => {
    const secret = generateTotpSecret(20);
    const currentStep = Math.floor(Date.now() / 30000);
    // 1 step in past
    const pastCode = generateTotpCode(secret, currentStep - 1);
    expect(verifyTotpCode(secret, pastCode, 1)).toBe(true);

    // 2 steps in past with window=1 fails
    const tooOldCode = generateTotpCode(secret, currentStep - 2);
    expect(verifyTotpCode(secret, tooOldCode, 1)).toBe(false);
  });

  it("generates 10 single-use recovery codes and consumes them securely", () => {
    const { codes, hashes } = generateRecoveryCodes(10);
    expect(codes.length).toBe(10);
    expect(hashes.length).toBe(10);

    const testCode = codes[0];
    const { valid, remainingHashes } = verifyAndConsumeRecoveryCode(testCode, hashes);
    expect(valid).toBe(true);
    expect(remainingHashes.length).toBe(9);

    // Cannot reuse consumed code
    const secondTry = verifyAndConsumeRecoveryCode(testCode, remainingHashes);
    expect(secondTry.valid).toBe(false);
    expect(secondTry.remainingHashes.length).toBe(9);
  });
});
