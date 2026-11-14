import { describe, expect, it, vi } from "vitest";
import { applyShipmentUpdate, customerStatus, isStale, mapProviderStatus } from "./shipment-status";

/** Minimal knex-transaction stub: enough query-builder surface for applyShipmentUpdate. */
function makeTrxStub(opts: { shipmentEventExists: boolean }) {
  const shipmentRow = {
    id: "shp_1",
    status: "created",
    awb: null,
    courier: null,
    shipped_at: null,
    delivered_at: null,
  };

  const shipmentTable = {
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ ...shipmentRow, status: "picked_up", awb: "AWB1" }]),
  };

  const eventTable = {
    insert: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockReturnThis(),
    ignore: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(opts.shipmentEventExists ? [] : [{ id: "shpevt_1" }]),
  };

  const trx = vi.fn((table: string) => (table === "shipment" ? shipmentTable : eventTable));
  return { trx: trx as unknown as Parameters<typeof applyShipmentUpdate>[0], shipmentRow, eventTable };
}

describe("mapProviderStatus / customerStatus / isStale", () => {
  it("maps known Shiprocket statuses and falls back to in_transit for unknown ones", () => {
    expect(mapProviderStatus("DELIVERED")).toBe("delivered");
    expect(mapProviderStatus("RTO INITIATED")).toBe("rto");
    expect(mapProviderStatus("some unknown status")).toBe("in_transit");
  });

  it("returns a human label for every mapped status", () => {
    expect(customerStatus("delivered")).toBe("Delivered");
    expect(customerStatus("not_a_real_status")).toBe("In transit");
  });

  it("flags a shipment stale after 12 hours with no sync", () => {
    expect(isStale(new Date(Date.now() - 13 * 60 * 60 * 1000))).toBe(true);
    expect(isStale(new Date())).toBe(false);
    expect(isStale(null)).toBe(false);
  });
});

describe("applyShipmentUpdate idempotency (apps/backend/src/lib/shipment-status.ts)", () => {
  const shipment = {
    id: "shp_1",
    status: "created",
    awb: null,
    courier: null,
    shipped_at: null,
    delivered_at: null,
  };

  it("records a new event and returns deduped: false on the first delivery", async () => {
    const { trx } = makeTrxStub({ shipmentEventExists: false });
    const result = await applyShipmentUpdate(trx, shipment, {
      status: "PICKED UP",
      awb: "AWB1",
      eventKey: "picked_up-2026-11-14T10:00:00",
      source: "shiprocket_webhook",
    });
    expect(result.status).toBe("picked_up");
    expect(result.deduped).toBe(false);
  });

  it("reports deduped: true when the same (shipment_id, event_key) is replayed", async () => {
    const { trx } = makeTrxStub({ shipmentEventExists: true });
    const result = await applyShipmentUpdate(trx, shipment, {
      status: "PICKED UP",
      awb: "AWB1",
      eventKey: "picked_up-2026-11-14T10:00:00",
      source: "shiprocket_webhook",
    });
    expect(result.deduped).toBe(true);
  });
});
