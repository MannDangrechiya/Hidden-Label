import { describe, expect, it } from "vitest";
import { refundOperationKey } from "./refund-operations";

const intent = {
  orderId: "order_01",
  paymentId: "pay_01",
  amount: 21999,
  reason: "Customer changed their mind",
};

describe("Refund operation identity (BUG-04)", () => {
  it("is stable across calls — no timestamp component", () => {
    const first = refundOperationKey(intent);
    const second = refundOperationKey({ ...intent });
    expect(second).toBe(first);
  });

  it("is a prefixed sha-256 digest, not a date", () => {
    const key = refundOperationKey(intent);
    expect(key).toMatch(/^rfn_[0-9a-f]{64}$/);
    expect(key).not.toMatch(/\d{13}/);
  });

  it("changes when any part of the financial intent changes", () => {
    const base = refundOperationKey(intent);
    expect(refundOperationKey({ ...intent, amount: 22000 })).not.toBe(base);
    expect(refundOperationKey({ ...intent, reason: "Damaged item" })).not.toBe(base);
    expect(refundOperationKey({ ...intent, paymentId: "pay_02" })).not.toBe(base);
    expect(refundOperationKey({ ...intent, orderId: "order_02" })).not.toBe(base);
  });

  it("treats the same reason with different whitespace or casing as one intent", () => {
    const base = refundOperationKey(intent);
    expect(refundOperationKey({ ...intent, reason: "  customer   changed their mind " })).toBe(base);
    expect(refundOperationKey({ ...intent, reason: "CUSTOMER CHANGED THEIR MIND" })).toBe(base);
  });

  it("does not collide across fractional amounts", () => {
    expect(refundOperationKey({ ...intent, amount: 21999.4 })).not.toBe(
      refundOperationKey({ ...intent, amount: 21999 }),
    );
  });
});
