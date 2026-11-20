import { describe, expect, it } from "vitest";
import {
  formatPaise,
  isAmountRepresentable,
  MoneyParseError,
  toPaise,
  toRupeesNumber,
} from "./money";

/**
 * R-06 regressions: refund amounts are reconciled in integer paise, never as floats.
 */
describe("Exact money parsing (R-06)", () => {
  it("parses numeric strings digit by digit", () => {
    expect(toPaise("21999.00")).toBe(2199900);
    expect(toPaise("12.5")).toBe(1250);
    expect(toPaise("12")).toBe(1200);
    expect(toPaise("0.07")).toBe(7);
    expect(toPaise("0.10")).toBe(10);
    expect(toPaise("-45.25")).toBe(-4525);
  });

  it("keeps repeated addition exact where floats drift", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in binary floating point.
    const total = toPaise("0.10") + toPaise("0.20");
    expect(formatPaise(total)).toBe("0.30");

    // 21.15 * 3 is 63.449999999999996 as a float.
    const line = toPaise("21.15");
    expect(formatPaise(line * 3)).toBe("63.45");
  });

  it("rejects amounts that a numeric(12,2) column could never hold", () => {
    expect(() => toPaise("1.005")).toThrow(MoneyParseError);
    expect(() => toPaise("abc")).toThrow(MoneyParseError);
    expect(() => toPaise("")).toThrow(MoneyParseError);
    expect(() => toPaise(1.005)).toThrow(MoneyParseError);
    expect(() => toPaise(Number.NaN)).toThrow(MoneyParseError);
    expect(() => toPaise("1e5")).toThrow(MoneyParseError);
  });

  it("formats paise back to a 2-decimal string without float maths", () => {
    expect(formatPaise(2199900)).toBe("21999.00");
    expect(formatPaise(5)).toBe("0.05");
    expect(formatPaise(0)).toBe("0.00");
    expect(formatPaise(-4525)).toBe("-45.25");
  });

  it("round-trips through the rupee number boundary used by the payment workflow", () => {
    for (const amount of ["21999.00", "1500.50", "0.99", "12345678.91"]) {
      const paise = toPaise(amount);
      expect(formatPaise(toPaise(toRupeesNumber(paise)))).toBe(formatPaise(paise));
    }
  });

  it("reports representability for request validation", () => {
    expect(isAmountRepresentable(1500)).toBe(true);
    expect(isAmountRepresentable("1500.50")).toBe(true);
    expect(isAmountRepresentable("1500.505")).toBe(false);
    expect(isAmountRepresentable(null)).toBe(false);
    expect(isAmountRepresentable(undefined)).toBe(false);
  });
});
