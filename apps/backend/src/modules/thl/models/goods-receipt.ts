import { model } from "@medusajs/framework/utils";

/**
 * GoodsReceipt: Warehouse goods received notes (GRN) against purchase orders (Phase 6).
 * Table: goods_receipt
 */
export const GoodsReceipt = model.define("goods_receipt", {
  id: model.id({ prefix: "grn" }).primaryKey(),
  display_id: model.text().unique(),
  purchase_order_id: model.text(),
  received_by: model.text(),
  received_at: model.dateTime(),
  notes: model.text().nullable(),
});
