import crypto from "node:crypto";
import type { Knex } from "knex";

export interface WebhookEventRow {
  id: string;
  event_id: string;
  provider: string;
  event_type: string;
  entity_id: string | null;
  payload_hash: string;
  status: "processed" | "ignored" | "failed";
  error: string | null;
  created_at: Date;
  processed_at: Date;
}

export interface RecordWebhookInput {
  eventId: string;
  provider: string;
  eventType: string;
  entityId?: string | null;
  payloadHash: string;
  status?: "processed" | "ignored" | "failed";
}

/**
 * Persists an incoming webhook event.
 * If the event was already recorded (by event_id), this detects duplicate delivery
 * and returns `duplicate: true`, preventing double-processing.
 */
export async function recordWebhookEvent(
  trx: Knex,
  input: RecordWebhookInput,
): Promise<{ recorded: boolean; duplicate: boolean; id: string }> {
  const id = `whevt_${crypto.randomBytes(12).toString("hex")}`;
  const status = input.status ?? "processed";

  const inserted = await trx("webhook_event")
    .insert({
      id,
      event_id: input.eventId,
      provider: input.provider,
      event_type: input.eventType,
      entity_id: input.entityId ?? null,
      payload_hash: input.payloadHash,
      status,
      created_at: new Date(),
      processed_at: new Date(),
    })
    .onConflict("event_id")
    .ignore()
    .returning("id");

  if (inserted && inserted.length > 0) {
    return { recorded: true, duplicate: false, id: inserted[0].id ?? id };
  }

  return { recorded: false, duplicate: true, id: "" };
}

/**
 * Checks whether an event was already processed.
 */
export async function isWebhookEventProcessed(
  trx: Knex,
  eventId: string,
): Promise<boolean> {
  const existing = await trx("webhook_event")
    .where({ event_id: eventId })
    .first("id");
  return Boolean(existing);
}
