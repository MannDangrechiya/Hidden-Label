import { model } from "@medusajs/framework/utils";

/**
 * Aura-7 Style Concierge thread (AI-05).
 * Table: concierge_thread (docs/PHASE_5.5_PLAN.md §2.5)
 *
 * `session_token_hash` binds a guest thread to the backend-issued signed session token. Only
 * the SHA-256 hash is stored, so a database read cannot be replayed as a session. A thread that
 * belongs to a signed-in customer is matched on `customer_id` instead and ignores the token.
 */
export const ConciergeThread = model.define("concierge_thread", {
  id: model.id({ prefix: "cth" }).primaryKey(),
  customer_id: model.text().nullable(),
  session_token: model.text(),
  session_token_hash: model.text().nullable(),
  title: model.text().default("Personal Styling Session"),
});
