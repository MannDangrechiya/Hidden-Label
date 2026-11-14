import { describe, expect, it } from "vitest";
import { checkReturnEligibility, RETURN_WINDOW_DAYS } from "./returns";

describe("Return Eligibility Engine (apps/backend/src/lib/returns.ts)", () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it("rejects final sale items unconditionally", () => {
    const result = checkReturnEligibility({
      orderStatus: "delivered",
      deliveredAt: new Date(),
      itemQuantity: 1,
      alreadyReturned: 0,
      finalSale: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Final-sale");
  });

  it("rejects returns if the order has not been delivered", () => {
    const statuses = ["pending", "not_fulfilled", "shipped", "in_transit", "requires_action"];
    for (const orderStatus of statuses) {
      const result = checkReturnEligibility({
        orderStatus,
        deliveredAt: null,
        itemQuantity: 1,
        alreadyReturned: 0,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("Returns open once the order has been delivered");
    }
  });

  it("rejects returns if deliveredAt timestamp is missing even if status is delivered", () => {
    const result = checkReturnEligibility({
      orderStatus: "delivered",
      deliveredAt: null,
      itemQuantity: 1,
      alreadyReturned: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("delivery date is not recorded");
  });

  it("rejects returns after the 7-day return window has closed", () => {
    const eightDaysAgo = new Date(Date.now() - (RETURN_WINDOW_DAYS + 1) * ONE_DAY_MS);
    const result = checkReturnEligibility({
      orderStatus: "delivered",
      deliveredAt: eightDaysAgo,
      itemQuantity: 1,
      alreadyReturned: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("window has closed");
  });

  it("accepts returns within the 7-day return window", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * ONE_DAY_MS);
    const result = checkReturnEligibility({
      orderStatus: "delivered",
      deliveredAt: twoDaysAgo,
      itemQuantity: 2,
      alreadyReturned: 0,
    });
    expect(result.eligible).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects returns when all units on the line have already been returned", () => {
    const yesterday = new Date(Date.now() - ONE_DAY_MS);
    const result = checkReturnEligibility({
      orderStatus: "delivered",
      deliveredAt: yesterday,
      itemQuantity: 2,
      alreadyReturned: 2,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("already been returned");
  });

  it("accepts partial returns when units remain eligible", () => {
    const yesterday = new Date(Date.now() - ONE_DAY_MS);
    const result = checkReturnEligibility({
      orderStatus: "delivered",
      deliveredAt: yesterday,
      itemQuantity: 3,
      alreadyReturned: 1,
    });
    expect(result.eligible).toBe(true);
  });
});
