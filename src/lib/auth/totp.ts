import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { sha256Hex } from "@/lib/security/crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function getTotpUri(params: { issuer: string; accountName: string; secret: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const issuer = encodeURIComponent(params.issuer);
  return `otpauth://totp/${label}?secret=${params.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateTotpCode(secret: string, timeStep = Math.floor(Date.now() / 30000)): string {
  const key = base32Decode(secret);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = createHmac("sha1", key).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (codeInt % 1_000_000).toString().padStart(6, "0");
  return code;
}

export function verifyTotpCode(secret: string, code: string, window = 1): boolean {
  if (!code || typeof code !== "string" || code.trim().length !== 6) return false;
  const targetCode = code.trim();
  const currentStep = Math.floor(Date.now() / 30000);

  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotpCode(secret, currentStep + offset);
    if (expected === targetCode) {
      return true;
    }
  }
  return false;
}

/**
 * Generate 10 single-use recovery codes formatted as `xxxx-xxxx` and their SHA-256 hashes.
 */
export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < count; i++) {
    const p1 = randomBytes(2).toString("hex");
    const p2 = randomBytes(2).toString("hex");
    const code = `${p1}-${p2}`.toLowerCase();
    codes.push(code);
    hashes.push(sha256Hex(code));
  }

  return { codes, hashes };
}

export function verifyAndConsumeRecoveryCode(
  inputCode: string,
  hashes: string[],
): { valid: boolean; remainingHashes: string[] } {
  const norm = inputCode.trim().toLowerCase();
  const inputHash = sha256Hex(norm);
  const idx = hashes.indexOf(inputHash);
  if (idx === -1) {
    return { valid: false, remainingHashes: hashes };
  }
  const remaining = hashes.filter((_, i) => i !== idx);
  return { valid: true, remainingHashes: remaining };
}
