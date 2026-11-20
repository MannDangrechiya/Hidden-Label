import { describe, expect, it } from "vitest";
import { decideStockLocation } from "./stock-location";

/**
 * R-07 regressions: the location policy, without a database.
 */
describe("Stock location policy (R-07)", () => {
  const two = ["sloc_a", "sloc_b"];

  it("uses an explicitly requested location", () => {
    const decision = decideStockLocation({
      requestedLocationId: "sloc_b",
      orderLocationId: "sloc_a",
      availableLocationIds: two,
    });
    expect(decision).toEqual({ ok: true, locationId: "sloc_b", source: "requested" });
  });

  it("rejects a requested location that does not exist", () => {
    const decision = decideStockLocation({
      requestedLocationId: "sloc_missing",
      availableLocationIds: two,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("location_not_found");
  });

  it("prefers the location the order was fulfilled from", () => {
    const decision = decideStockLocation({ orderLocationId: "sloc_b", availableLocationIds: two });
    expect(decision).toEqual({ ok: true, locationId: "sloc_b", source: "order" });
  });

  it("uses the single location when there is exactly one", () => {
    const decision = decideStockLocation({ availableLocationIds: ["sloc_only"] });
    expect(decision).toEqual({ ok: true, locationId: "sloc_only", source: "only_location" });
  });

  it("fails closed when several locations exist and none is known", () => {
    const decision = decideStockLocation({ availableLocationIds: two });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("location_required");
      expect(decision.status).toBe(422);
    }
  });

  it("fails closed when no location exists", () => {
    const decision = decideStockLocation({ availableLocationIds: [] });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("no_location");
  });

  it("ignores a fulfilment location that has since been removed", () => {
    const decision = decideStockLocation({
      orderLocationId: "sloc_deleted",
      availableLocationIds: ["sloc_only"],
    });
    expect(decision).toEqual({ ok: true, locationId: "sloc_only", source: "only_location" });
  });
});
