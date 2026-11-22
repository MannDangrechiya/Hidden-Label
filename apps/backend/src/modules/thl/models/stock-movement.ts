import { model } from "@medusajs/framework/utils";

/**
 * StockMovement: Immutable ledger tracking every stock mutation (Phase 6).
 * Table: stock_movement
 */
export const StockMovement = model.define("stock_movement", {
  id: model.id({ prefix: "sm" }).primaryKey(),
  inventory_item_id: model.text(),
  location_id: model.text(),
  delta: model.number(),
  movement_type: model.text(),
  reference_id: model.text().nullable(),
  actor_id: model.text().nullable(),
  notes: model.text().nullable(),
  balance_after: model.number(),
});
