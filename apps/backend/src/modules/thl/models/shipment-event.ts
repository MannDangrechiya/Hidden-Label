import { model } from "@medusajs/framework/utils";

/**
 * Append-only tracking events, deduped by (shipment_id, event_key).
 * Table: shipment_event.
 */
export const ShipmentEvent = model.define("shipment_event", {
  id: model.id({ prefix: "shpevt" }).primaryKey(),
  shipment_id: model.text(),
  event_key: model.text(),
  status: model.text(),
  occurred_at: model.dateTime(),
  payload: model.json().nullable(),
});
