import { model } from "@medusajs/framework/utils";

/**
 * PurchaseOrder: Wholesale and inventory restocking purchase orders (Phase 6).
 * Table: purchase_order
 */
export const PurchaseOrder = model.define("purchase_order", {
  id: model.id({ prefix: "po" }).primaryKey(),
  display_id: model.text().unique(),
  supplier_id: model.text(),
  status: model.text().default("draft"),
  total_cost_rupees: model.number().default(0),
  notes: model.text().nullable(),
});
