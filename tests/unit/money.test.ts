import { describe, it, expect } from "vitest";
import {
  addMinor,
  multiplyMinor,
  applyBps,
  inclusiveTaxPortion,
  allocateProportionally,
  parseMajorToMinor,
  minorToMajorString,
  formatMoney,
} from "@/lib/money";

describe("Money minor-unit arithmetic", () => {
  it("adds minor units safely", () => {
    expect(addMinor(100, 250, 50)).toBe(400);
    expect(addMinor(0)).toBe(0);
  });

  it("multiplies unit price by quantity safely", () => {
    expect(multiplyMinor(1999, 3)).toBe(5997);
    expect(multiplyMinor(500, 0)).toBe(0);
  });

  it("applies basis points with half-up rounding", () => {
    // 1000 * 500 bps (5%) = 50
    expect(applyBps(1000, 500)).toBe(50);
    // 1000 * 10000 bps (100%) = 1000
    expect(applyBps(1000, 10000)).toBe(1000);
    // 995 * 750 bps (7.5%) = 74.625 -> 75
    expect(applyBps(995, 750)).toBe(75);
    // 0 rate
    expect(applyBps(1000, 0)).toBe(0);
  });

  it("extracts tax-inclusive portions correctly", () => {
    // $120 gross with 20% VAT (2000 bps): 120 * 2000 / 12000 = 20
    expect(inclusiveTaxPortion(12000, 2000)).toBe(2000);
    expect(inclusiveTaxPortion(10000, 0)).toBe(0);
  });

  it("allocates amounts proportionally with largest remainder method", () => {
    // $10 discount across three items costing $20, $30, $50
    const parts = allocateProportionally(1000, [2000, 3000, 5000]);
    expect(parts).toEqual([200, 300, 500]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);

    // Indivisible remainder: 100 cents split 3 ways [33, 33, 33] + 1 remainder -> [34, 33, 33]
    const split3 = allocateProportionally(100, [1, 1, 1]);
    expect(split3.reduce((a, b) => a + b, 0)).toBe(100);
    expect(split3).toEqual([34, 33, 33]);
  });

  it("parses user-entered decimal string to minor units without float errors", () => {
    expect(parseMajorToMinor("19.99", "USD")).toBe(1999);
    expect(parseMajorToMinor("100", "USD")).toBe(10000);
    expect(parseMajorToMinor("0.05", "USD")).toBe(5);
    expect(parseMajorToMinor("1500", "JPY")).toBe(1500); // 0 decimals

    expect(() => parseMajorToMinor("19.999", "USD")).toThrow(/At most 2 decimal places/);
    expect(() => parseMajorToMinor("-5.00", "USD")).toThrow(/Invalid amount format/);
    expect(() => parseMajorToMinor("abc", "USD")).toThrow(/Invalid amount format/);
  });

  it("converts minor units back to clean decimal strings", () => {
    expect(minorToMajorString(1999, "USD")).toBe("19.99");
    expect(minorToMajorString(5, "USD")).toBe("0.05");
    expect(minorToMajorString(10000, "USD")).toBe("100.00");
    expect(minorToMajorString(1500, "JPY")).toBe("1500");
  });

  it("formats currency strings for display", () => {
    const formatted = formatMoney(1999, "USD");
    expect(formatted).toContain("19.99");
  });
});
