import { model } from "@medusajs/framework/utils";

/**
 * Aura-7 Style Concierge thread (AI-05).
 * Table: concierge_thread (docs/PHASE_5.5_PLAN.md §2.5)
 */
export const ConciergeThread = model.define("concierge_thread", {
  id: model.id({ prefix: "cth" }).primaryKey(),
  customer_id: model.text().nullable(),
  session_token: model.text(),
  title: model.text().default("Personal Styling Session"),
});
