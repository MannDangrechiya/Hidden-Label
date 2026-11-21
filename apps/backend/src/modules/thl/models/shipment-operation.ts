import { model } from "@medusajs/framework/utils";

/**
 * Persisted shipment operation mutex & idempotency record.
 * Guarantees concurrent or repeated shipment creation requests resolve to exactly
 * one courier shipment and AWB without duplicate dispatches.
 * Table: shipment_operation.
 */
export const ShipmentOperation = model.define("shipment_operation", {
  id: model.id({ prefix: "shpop" }).primaryKey(),
  idempotency_key: model.text().unique(),
  order_id: model.text(),
  fulfillment_id: model.text().nullable(),
  shipment_id: model.text().nullable(),
  provider_order_id: model.text().nullable(),
  provider_shipment_id: model.text().nullable(),
  awb: model.text().nullable(),
  courier: model.text().nullable(),
  status: model.text().default("pending"),
  error: model.text().nullable(),
});
