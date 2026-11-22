import { model } from "@medusajs/framework/utils";

/**
 * Supplier: Luxury brand suppliers, ateliers and distributors (Phase 6).
 * Table: supplier
 */
export const Supplier = model.define("supplier", {
  id: model.id({ prefix: "sup" }).primaryKey(),
  name: model.text(),
  contact_email: model.text(),
  contact_phone: model.text().nullable(),
  gstin: model.text().nullable(),
  address: model.text().nullable(),
  status: model.text().default("active"),
});
