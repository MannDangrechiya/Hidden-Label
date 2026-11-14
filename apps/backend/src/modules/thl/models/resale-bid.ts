import { model } from "@medusajs/framework/utils";

/**
 * Resale bid: buyer bid per variant in marketplace orderbook.
 * Table: resale_bid (docs/PHASE_5.5_PLAN.md §2.1)
 */
export const ResaleBid = model.define("resale_bid", {
  id: model.id({ prefix: "bid" }).primaryKey(),
  variant_id: model.text(),
  buyer_id: model.text(),
  bid_price: model.number(),
  status: model.text().default("active"),
  payment_intent: model.text().nullable(),
  expires_at: model.dateTime(),
});
