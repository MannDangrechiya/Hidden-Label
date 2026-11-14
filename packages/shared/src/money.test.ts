import { describe, expect, it } from "vitest";
import { formatINR, money, moneyFromRupees, MoneyError, sumMoney, toRupees } from "./money";

describe("money", () => {
  it("stores integer paise", () => {
    expect(money(3899000).amount).toBe(3899000);
  });

  it("rejects non-integers, so no float can enter the system", () => {
    expect(() => money(3899.5)).toThrow(MoneyError);
  });

  it("rejects negative amounts", () => {
    expect(() => money(-1)).toThrow(MoneyError);
  });

  it("converts rupees to paise exactly", () => {
    expect(moneyFromRupees("38990").amount).toBe(3899000);
    expect(moneyFromRupees(2499.99).amount).toBe(249999);
  });
});

describe("sumMoney", () => {
  it("adds without floating point drift", () => {
    const total = sumMoney([money(1999), money(1999), money(1999)]);
    expect(total.amount).toBe(5997);
    expect(toRupees(total)).toBeCloseTo(59.97, 2);
  });

  it("refuses to mix currencies", () => {
    expect(() => sumMoney([money(100, "inr")], "inr")).not.toThrow();
  });
});

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(money(3899000))).toBe("₹38,990");
    expect(formatINR(money(12450000))).toBe("₹1,24,500");
    expect(formatINR(money(1000000000))).toBe("₹1,00,00,000");
  });

  it("shows paise only when they exist", () => {
    expect(formatINR(money(0))).toBe("₹0");
    expect(formatINR(money(12345))).toBe("₹123.45");
  });
});
