import { model } from "@medusajs/framework/utils";

/** RMA line. Table: return_request_item. */
export const ReturnItem = model.define("return_request_item", {
  id: model.id({ prefix: "rmaitem" }).primaryKey(),
  return_request_id: model.text(),
  order_item_id: model.text(),
  quantity: model.number().default(1),
  restock_decision: model.text().nullable(),
  condition_note: model.text().nullable(),
});
