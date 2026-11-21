import { model } from "@medusajs/framework/utils";

/**
 * Phase 2: Persisted log of verified external webhooks to ensure strict exactly-once processing.
 * Table: webhook_event.
 */
export const WebhookEvent = model.define("webhook_event", {
  id: model.id({ prefix: "whevt" }).primaryKey(),
  event_id: model.text().unique(),
  provider: model.text(),
  event_type: model.text(),
  entity_id: model.text().nullable(),
  payload_hash: model.text(),
  status: model.text().default("processed"),
  error: model.text().nullable(),
  processed_at: model.dateTime().nullable(),
});
