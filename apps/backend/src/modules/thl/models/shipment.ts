import { model } from "@medusajs/framework/utils";

/** Local mirror of the Shiprocket shipment. Table: shipment. */
export const Shipment = model.define("shipment", {
  id: model.id({ prefix: "shp" }).primaryKey(),
  order_id: model.text(),
  fulfillment_id: model.text().nullable(),
  provider: model.text().default("shiprocket"),
  provider_shipment_id: model.text().nullable(),
  awb: model.text().nullable(),
  courier: model.text().nullable(),
  status: model.text().default("created"),
  label_url: model.text().nullable(),
  manifest_url: model.text().nullable(),
  shipped_at: model.dateTime().nullable(),
  delivered_at: model.dateTime().nullable(),
  last_synced_at: model.dateTime().nullable(),
  raw_last_event: model.json().nullable(),
});
