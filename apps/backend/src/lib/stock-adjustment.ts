import type { Knex } from "knex";
import { writeAudit } from "./audit";

export const ADJUST_REASONS = [
  "count_correction",
  "stock_count",
  "damaged",
  "lost",
  "return_restock",
  "sample",
  "transfer",
] as const;

export type AdjustReason = (typeof ADJUST_REASONS)[number];

export interface AdjustStockInput {
  inventoryItemId: string;
  locationId: string;
  delta: number;
  reason: AdjustReason;
}

export interface AdjustStockAudit {
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Optional human reference for the audit summary, e.g. an RMA display id. */
  reference?: string | null;
}

export type AdjustStockOutcome =
  | {
      ok: true;
      level: Record<string, unknown>;
      before: number;
      after: number;
      available: number;
    }
  | {
      ok: false;
      status: 400 | 404 | 422;
      code: "invalid_data" | "not_found" | "negative_quantity";
      message: string;
    };

/**
 * BUG-05: the previous implementation read `stocked_quantity`, computed the next value in
 * application memory and then wrote it. Two concurrent adjustments both read the same starting
 * quantity and the later write silently discarded the earlier one.
 *
 * `applyStockDelta` takes a row lock (`SELECT … FOR UPDATE`) on the inventory level inside the
 * caller's transaction, so read-compute-write is serialised per level, re-evaluates the negative
 * bound under that lock, and writes the audit row atomically with the mutation. It is exported
 * so other transactional flows (return restock, R-05) share the one locked implementation
 * instead of re-implementing a read-then-write.
 */
export async function applyStockDelta(
  trx: Knex,
  input: AdjustStockInput,
  audit: AdjustStockAudit,
): Promise<AdjustStockOutcome> {
  const { delta } = input;
  if (!Number.isInteger(delta) || delta === 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_data",
      message: "A non-zero integer delta is required.",
    };
  }

  if (!input.inventoryItemId || !input.locationId) {
    return {
      ok: false,
      status: 400,
      code: "invalid_data",
      message: "An inventory item and location are required.",
    };
  }

  const level = await trx("inventory_level")
    .where({
      inventory_item_id: input.inventoryItemId,
      location_id: input.locationId,
    })
    .forUpdate()
    .first();

  if (!level) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "Inventory level not found.",
    };
  }

  const before = Number(level.stocked_quantity);
  const after = before + delta;

  if (after < 0) {
    return {
      ok: false,
      status: 422,
      code: "negative_quantity",
      message: `Adjusting by ${delta} would leave a negative quantity (${after}).`,
    };
  }

  const [row] = await trx("inventory_level")
    .where({ id: level.id })
    .update({ stocked_quantity: after, updated_at: new Date() })
    .returning("*");

  await writeAudit(trx, {
    actorType: "admin",
    actorId: audit.actorId,
    action: "inventory.adjusted",
    entityType: "inventory_item",
    entityId: input.inventoryItemId,
    summary: `Stock adjusted by ${delta > 0 ? "+" : ""}${delta} (${input.reason}${
      audit.reference ? `, ${audit.reference}` : ""
    })`,
    changes: { before, after, reason: input.reason },
    ip: audit.ip ?? null,
    userAgent: audit.userAgent ?? null,
  });

  return {
    ok: true,
    level: row,
    before,
    after,
    available: after - Number(row.reserved_quantity ?? 0),
  };
}

/** Standalone adjustment: one transaction around the shared locked mutation. */
export async function adjustStock(
  db: Knex,
  input: AdjustStockInput,
  audit: AdjustStockAudit,
): Promise<AdjustStockOutcome> {
  return db.transaction((trx) => applyStockDelta(trx, input, audit));
}
