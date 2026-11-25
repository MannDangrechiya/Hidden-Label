import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { applyShipmentUpdate, type ShipmentRow } from "./shipment-status";

/**
 * Regression tests for the delivered handshake: whichever path marks a shipment delivered —
 * the operator's manual update in admin or the Shiprocket webhook — must also mark the Medusa
 * fulfillment delivered, because return eligibility reads fulfillment.delivered_at.
 * (Defect: POST /admin/shipments/:id with {status:"delivered"} set only shipment.delivered_at,
 * leaving operator-delivered orders return-ineligible.)
 */
describe("applyShipmentUpdate — delivered handshake (Integration)", () => {
  let iso: IsolatedDatabase;

  beforeEach(async () => {
    iso = await createIsolatedDatabase();

    await iso.db("order").insert({ id: "order_dh_01", display_id: 7 });
    await iso.db("fulfillment").insert({ id: "ful_dh_01" });
    await iso.db("order_fulfillment").insert({ order_id: "order_dh_01", fulfillment_id: "ful_dh_01" });
    await iso.db("shipment").insert({
      id: "shp_dh_01",
      order_id: "order_dh_01",
      provider: "shiprocket",
      awb: "SRMOCK-DH-01",
      status: "in_transit",
    });
  });

  afterEach(async () => {
    await iso.dispose();
  });

  function shipmentRow(): Promise<ShipmentRow> {
    return iso.db("shipment").where({ id: "shp_dh_01" }).first() as Promise<ShipmentRow>;
  }

  it("the admin manual path marks the fulfillment delivered, not just the shipment", async () => {
    const shipment = await shipmentRow();

    await iso.db.transaction((trx) =>
      applyShipmentUpdate(trx, shipment, {
        status: "Delivered", // provider vocabulary, exactly as the admin route passes it
        source: "admin",
      }),
    );

    const updated = await shipmentRow();
    expect(updated.status).toBe("delivered");
    expect(updated.delivered_at).not.toBeNull();

    const fulfillment = await iso.db("fulfillment").where({ id: "ful_dh_01" }).first();
    expect(fulfillment.delivered_at).not.toBeNull();
  });

  it("the webhook path still marks the fulfillment delivered through the same logic", async () => {
    const shipment = await shipmentRow();

    await iso.db.transaction((trx) =>
      applyShipmentUpdate(trx, shipment, {
        status: "DELIVERED",
        source: "shiprocket_webhook",
      }),
    );

    const fulfillment = await iso.db("fulfillment").where({ id: "ful_dh_01" }).first();
    expect(fulfillment.delivered_at).not.toBeNull();
  });

  it("is idempotent: a replayed delivered scan never rewrites the first delivered_at", async () => {
    const shipment = await shipmentRow();
    await iso.db.transaction((trx) =>
      applyShipmentUpdate(trx, shipment, { status: "DELIVERED", source: "shiprocket_webhook" }),
    );

    const first = await iso.db("fulfillment").where({ id: "ful_dh_01" }).first("delivered_at");
    const shipmentFirst = await shipmentRow();

    await iso.db.transaction((trx) =>
      applyShipmentUpdate(trx, shipmentFirst, {
        status: "DELIVERED",
        source: "shiprocket_webhook",
        eventKey: "DELIVERED-later-scan",
      }),
    );

    const second = await iso.db("fulfillment").where({ id: "ful_dh_01" }).first("delivered_at");
    expect(new Date(second.delivered_at).getTime()).toBe(new Date(first.delivered_at).getTime());
    expect(new Date(shipmentFirst.delivered_at).getTime()).toBe(
      new Date((await shipmentRow()).delivered_at).getTime(),
    );
  });

  it("non-delivered transitions leave the fulfillment untouched", async () => {
    const shipment = await shipmentRow();
    await iso.db.transaction((trx) =>
      applyShipmentUpdate(trx, shipment, { status: "OUT FOR DELIVERY", source: "shiprocket_webhook" }),
    );

    const fulfillment = await iso.db("fulfillment").where({ id: "ful_dh_01" }).first();
    expect(fulfillment.delivered_at).toBeNull();
  });
});
