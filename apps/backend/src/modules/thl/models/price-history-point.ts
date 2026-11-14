import { model } from "@medusajs/framework/utils";

/**
 * Historical trade / price index point (AI-02 The Price Index).
 * Table: price_history_point (docs/PHASE_5.5_PLAN.md §2.2)
 */
export const PriceHistoryPoint = model.define("price_history_point", {
  id: model.id({ prefix: "php" }).primaryKey(),
  variant_id: model.text(),
  price_rupees: model.number(),
  condition_grade: model.text().default("deadstock"),
  source: model.text().default("marketplace"),
  recorded_at: model.dateTime(),
});
