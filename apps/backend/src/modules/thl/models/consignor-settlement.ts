import { model } from "@medusajs/framework/utils";

/**
 * ConsignorSettlement: Settlement ledger and payout tracking for resale sales (Phase 8).
 * Table: consignor_settlement
 */
export const ConsignorSettlement = model.define("consignor_settlement", {
  id: model.id({ prefix: "cst" }).primaryKey(),
  ask_id: model.text(),
  order_id: model.text().nullable(),
  seller_id: model.text(),
  sold_amount_rupees: model.number(),
  commission_rate: model.number(),
  commission_rupees: model.number(),
  payout_amount_rupees: model.number(),
  hold_until: model.dateTime(),
  status: model.text().default("pending"),
  disbursed_at: model.dateTime().nullable(),
  payout_reference: model.text().nullable(),
});
