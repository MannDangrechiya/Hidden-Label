import { model } from "@medusajs/framework/utils";

/**
 * Aura-7 Style Concierge message (AI-05).
 * Table: concierge_message (docs/PHASE_5.5_PLAN.md §2.5)
 */
export const ConciergeMessage = model.define("concierge_message", {
  id: model.id({ prefix: "cmsg" }).primaryKey(),
  thread_id: model.text(),
  sender: model.text(),
  content: model.text(),
  recommended_product_ids: model.json(),
});
