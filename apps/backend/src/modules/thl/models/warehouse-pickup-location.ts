import { model } from "@medusajs/framework/utils";

/**
 * Dynamic warehouse pickup location mapping.
 * Connects physical inventory locations to Shiprocket pickup nicknames.
 * Table: warehouse_pickup_location.
 */
export const WarehousePickupLocation = model.define("warehouse_pickup_location", {
  id: model.id({ prefix: "wploc" }).primaryKey(),
  stock_location_id: model.text(),
  pickup_location_code: model.text().unique(),
  pickup_location_nickname: model.text(),
  company_name: model.text(),
  contact_person: model.text(),
  email: model.text(),
  phone: model.text(),
  address_line1: model.text(),
  address_line2: model.text().nullable(),
  city: model.text(),
  state: model.text(),
  pincode: model.text(),
  is_default: model.boolean().default(false),
  is_active: model.boolean().default(true),
});
