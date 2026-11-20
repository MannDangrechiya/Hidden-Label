import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { resolveStockLocation } from "./stock-location";

let iso: IsolatedDatabase;

beforeAll(async () => {
  iso = await createIsolatedDatabase();
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

async function resetLocations(ids: string[]): Promise<void> {
  await iso.db("stock_location").del();
  await iso.db("fulfillment").del();
  await iso.db("order_fulfillment").del();
  for (const id of ids) {
    await iso.db("stock_location").insert({ id, name: `Warehouse ${id}` });
  }
}

async function recordFulfillment(orderId: string, fulfillmentId: string, locationId: string) {
  await iso.db("fulfillment").insert({ id: fulfillmentId, location_id: locationId });
  await iso.db("order_fulfillment").insert({ order_id: orderId, fulfillment_id: fulfillmentId });
}

describe("Stock location resolution (R-07)", () => {
  it("reads the location the order was fulfilled from, not the first row in the table", async () => {
    await resetLocations(["sloc_a", "sloc_z"]);
    await recordFulfillment("order_two_locations", "ful_1", "sloc_z");

    const decision = await resolveStockLocation(iso.db, { orderId: "order_two_locations" });
    expect(decision).toEqual({ ok: true, locationId: "sloc_z", source: "order" });
  });

  it("falls back to the only location when the order has no fulfilment", async () => {
    await resetLocations(["sloc_solo"]);

    const decision = await resolveStockLocation(iso.db, { orderId: "order_unfulfilled" });
    expect(decision).toEqual({ ok: true, locationId: "sloc_solo", source: "only_location" });
  });

  it("refuses to guess when several locations exist and the order records none", async () => {
    await resetLocations(["sloc_a", "sloc_b"]);

    const decision = await resolveStockLocation(iso.db, { orderId: "order_ambiguous" });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("location_required");
      expect(decision.status).toBe(422);
    }
  });

  it("honours an explicit location and rejects an unknown one", async () => {
    await resetLocations(["sloc_a", "sloc_b"]);
    await recordFulfillment("order_override", "ful_2", "sloc_b");

    const overridden = await resolveStockLocation(iso.db, {
      orderId: "order_override",
      requestedLocationId: "sloc_a",
    });
    expect(overridden).toEqual({ ok: true, locationId: "sloc_a", source: "requested" });

    const unknown = await resolveStockLocation(iso.db, {
      orderId: "order_override",
      requestedLocationId: "sloc_missing",
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe("location_not_found");
  });

  it("uses the most recent fulfilment when an order shipped in several parcels", async () => {
    await resetLocations(["sloc_a", "sloc_b"]);
    await iso.db("fulfillment").insert({
      id: "ful_old",
      location_id: "sloc_a",
      created_at: new Date("2026-01-01T00:00:00Z"),
    });
    await iso.db("fulfillment").insert({
      id: "ful_new",
      location_id: "sloc_b",
      created_at: new Date("2026-02-01T00:00:00Z"),
    });
    await iso.db("order_fulfillment").insert([
      { order_id: "order_split", fulfillment_id: "ful_old" },
      { order_id: "order_split", fulfillment_id: "ful_new" },
    ]);

    const decision = await resolveStockLocation(iso.db, { orderId: "order_split" });
    expect(decision).toEqual({ ok: true, locationId: "sloc_b", source: "order" });
  });
});
