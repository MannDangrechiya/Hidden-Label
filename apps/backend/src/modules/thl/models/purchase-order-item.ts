import { model } from "@medusajs/framework/utils";

/**
 * PurchaseOrderItem: Line items within a purchase order (Phase 6).
 * Table: purchase_order_item
 */
export const PurchaseOrderItem = model.define("purchase_order_item", {
  id: model.id({ prefix: "poi" }).primaryKey(),
  purchase_order_id: model.text(),
  product_id: model.text(),
  variant_id: model.text(),
  quantity: model.number(),
  received_quantity: model.number().default(0),
  unit_cost_rupees: model.number(),
});
