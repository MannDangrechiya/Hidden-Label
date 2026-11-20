import type { Knex } from "knex";

export const RETURN_DISPLAY_SEQUENCE = "return_request_display_seq";

/**
 * BUG-08: the RMA number was `RMA-${1000 + count + 1}`. Two concurrent requests read the same
 * count and then collided on the unique `display_id` index, turning one request into a 500.
 *
 * A PostgreSQL sequence is atomic under concurrency and survives restarts. The migration
 * backfills it past every existing `RMA-<n>` value so numbers are never reused.
 */
export async function nextReturnDisplayId(db: Knex): Promise<string> {
  const result = await db.raw("select nextval('??') as value", [RETURN_DISPLAY_SEQUENCE]);
  const raw = Array.isArray(result) ? result[0]?.value : result?.rows?.[0]?.value;
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Could not allocate a return display id from the database sequence.");
  }

  return `RMA-${value}`;
}

export function formatReturnDisplayId(value: number): string {
  return `RMA-${value}`;
}
