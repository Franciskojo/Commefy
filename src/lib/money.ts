/**
 * Money utilities. All amounts are integers in the currency's minor unit (e.g. cents, kobo).
 * Floating point is never used for stored or computed financial values.
 */

/** ISO-4217 minor-unit exponents for supported currencies. */
export const CURRENCIES = {
  USD: { exponent: 2, symbol: "$", name: "US Dollar" },
  EUR: { exponent: 2, symbol: "€", name: "Euro" },
  GBP: { exponent: 2, symbol: "£", name: "British Pound" },
  NGN: { exponent: 2, symbol: "₦", name: "Nigerian Naira" },
  GHS: { exponent: 2, symbol: "GH₵", name: "Ghanaian Cedi" },
  KES: { exponent: 2, symbol: "KSh", name: "Kenyan Shilling" },
  ZAR: { exponent: 2, symbol: "R", name: "South African Rand" },
  CAD: { exponent: 2, symbol: "CA$", name: "Canadian Dollar" },
  AUD: { exponent: 2, symbol: "A$", name: "Australian Dollar" },
  JPY: { exponent: 0, symbol: "¥", name: "Japanese Yen" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(v: string): v is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, v);
}

export function assertMinor(n: number, label = "amount"): number {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${label} must be a safe integer in minor units`);
  return n;
}

export function addMinor(...values: number[]): number {
  let total = 0;
  for (const v of values) total = assertMinor(total + assertMinor(v));
  return total;
}

export function multiplyMinor(unit: number, qty: number): number {
  assertMinor(unit, "unit");
  if (!Number.isSafeInteger(qty) || qty < 0) throw new RangeError("quantity must be a non-negative integer");
  return assertMinor(unit * qty);
}

/**
 * Apply a rate expressed in basis points (1 bps = 0.01%) using integer arithmetic with
 * round-half-up. 10_000 bps = 100%.
 */
export function applyBps(amount: number, bps: number): number {
  assertMinor(amount);
  if (!Number.isSafeInteger(bps) || bps < 0) throw new RangeError("bps must be a non-negative integer");
  // (amount * bps + 5000) / 10000 using integer division, sign-aware
  const product = BigInt(amount) * BigInt(bps);
  const rounded = (product + BigInt(5000)) / BigInt(10000);
  return Number(rounded);
}

/** Extract the tax portion contained in a tax-inclusive amount: amount * rate / (1 + rate). */
export function inclusiveTaxPortion(grossAmount: number, bps: number): number {
  assertMinor(grossAmount);
  if (bps <= 0) return 0;
  const num = BigInt(grossAmount) * BigInt(bps);
  const den = BigInt(10000 + bps);
  const two = BigInt(2);
  return Number((num * two + den) / (den * two)); // round half up
}

/**
 * Allocate `total` across `weights` proportionally so the parts sum exactly to `total`
 * (largest remainder method). Used to distribute order-level discounts across lines.
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  assertMinor(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (BigInt(total) * BigInt(w)) / BigInt(sum));
  const parts = raw.map(Number);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const fractions = weights
    .map((w, i) => ({ i, frac: Number((BigInt(total) * BigInt(w)) % BigInt(sum)) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of fractions) {
    if (remainder <= 0) break;
    parts[i] += 1;
    remainder -= 1;
  }
  return parts;
}

/** Parse a user-entered decimal string ("19.99") into minor units without floating point. */
export function parseMajorToMinor(input: string, currency: CurrencyCode): number {
  const exp = CURRENCIES[currency].exponent;
  const s = input.trim();
  const m = /^(\d{1,12})(?:\.(\d+))?$/.exec(s);
  if (!m) throw new RangeError("Invalid amount format");
  const whole = m[1];
  const frac = m[2] ?? "";
  if (frac.length > exp) throw new RangeError(`At most ${exp} decimal places allowed for ${currency}`);
  const minor = BigInt(whole) * BigInt(10) ** BigInt(exp) + BigInt(frac.padEnd(exp, "0") || "0");
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Amount too large");
  return Number(minor);
}

/** Convert minor units into a plain decimal string (no locale) – e.g. for form defaults. */
export function minorToMajorString(minor: number, currency: CurrencyCode): string {
  const exp = CURRENCIES[currency].exponent;
  const neg = minor < 0;
  const abs = Math.abs(minor).toString().padStart(exp + 1, "0");
  const whole = exp ? abs.slice(0, -exp) : abs;
  const frac = exp ? abs.slice(-exp) : "";
  return `${neg ? "-" : ""}${whole}${exp ? "." + frac : ""}`;
}

export function formatMoney(minor: number, currency: CurrencyCode | string, locale = "en-US"): string {
  const code = isCurrencyCode(currency) ? currency : "USD";
  const exp = CURRENCIES[code].exponent;
  // Intl requires a number; division here is display-only and never fed back into arithmetic.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(minor / 10 ** exp);
}
