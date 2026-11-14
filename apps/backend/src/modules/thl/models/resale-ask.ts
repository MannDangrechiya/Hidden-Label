import { model } from "@medusajs/framework/utils";

/**
 * Resale ask: seller / consignor listing per variant.
 * Table: resale_ask (docs/PHASE_5.5_PLAN.md §2.1)
 */
export const ResaleAsk = model.define("resale_ask", {
  id: model.id({ prefix: "ask" }).primaryKey(),
  variant_id: model.text(),
  seller_id: model.text(),
  ask_price: model.number(),
  condition_grade: model.text().default("deadstock"),
  box_condition: model.text().default("perfect"),
  status: model.text().default("active"),
  expires_at: model.dateTime().nullable(),
});
