import "server-only";
import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * OWASP recommended baseline for Argon2id:
 * memoryCost: 19 MiB (19456 KiB)
 * timeCost: 2 iterations
 * parallelism: 1 lane
 */
const ARGON_OPTIONS = {
  // Argon2id algorithm enum value in @node-rs/argon2 is 2
  algorithm: 2 as Algorithm,
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

// Pre-computed dummy hash used to neutralize timing attacks during failed logins
let DUMMY_HASH: string | null = null;

async function getDummyHash(): Promise<string> {
  if (!DUMMY_HASH) {
    DUMMY_HASH = await hash("storeforge-dummy-password-timing-neutralizer", ARGON_OPTIONS);
  }
  return DUMMY_HASH;
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

/**
 * Run a dummy verification to equalise execution time when an account does not exist.
 */
export async function verifyDummyPassword(): Promise<void> {
  const dummy = await getDummyHash();
  try {
    await verify(dummy, "storeforge-dummy-password-wrong");
  } catch {
    // ignore
  }
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (typeof password !== "string" || password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password cannot exceed 128 characters" };
  }
  // Check for at least one number or symbol and one letter
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasLetter || !hasNumberOrSymbol) {
    return { valid: false, message: "Password must include both letters and numbers or symbols" };
  }
  return { valid: true };
}
