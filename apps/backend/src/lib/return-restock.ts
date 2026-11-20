import type { Knex } from "knex";
import { applyStockDelta, type AdjustStockAudit } from "./stock-adjustment";

/**
 * R-05: restocking a received return was a read-then-write with no lock and no once-only guard.
 *
 * Failure scenarios it fixes:
 *   a. two operators (or a double-click) mark the same RMA `receive` concurrently — both read
 *      `restocked_at = null`, both add the units, stock rises by 2× the returned quantity;
 *   b. a retried request re-receives an RMA that was already restocked — the units are added
 *      again with no bound at all;
 *   c. two different RMAs for the same item restock at the same moment — the classic lost
 *      update from BUG-05, because the increment was computed in application memory.
 *
 * The fix has two layers:
 *   - every increment goes through `applyStockDelta`, which locks the inventory level
 *     (`SELECT … FOR UPDATE`) inside the caller's transaction, so concurrent restocks compose;
 *   - `restocked_at` is set with a conditional `UPDATE … WHERE restocked_at IS NULL`. Only one
 *     transaction can win that transition; a loser throws, which rolls its increments back. The
 *     guarantee therefore holds at the database, even if a future caller forgets to check.
 */

export interface RestockLine {
  inventoryItemId: string;
  quantity: number;
}

export interface RestockInput {
  returnRequestId: string;
  /** RMA display id, used only for the audit summary. */
  displayId?: string | null;
  locationId: string;
  lines: readonly RestockLine[];
  audit: AdjustStockAudit;
}

export type RestockReason = "restocked" | "already_restocked" | "nothing_to_restock";

export interface RestockOutcome {
  restocked: boolean;
  reason: RestockReason;
  locationId: string;
  /** Units actually added to sellable stock. */
  units: number;
  skipped: { inventoryItemId: string; reason: string }[];
}

/**
 * Several return lines can point at the same variant (two sizes of one SKU share an inventory
 * item, or the customer returned the same line twice). Summing first means one locked update per
 * inventory item instead of competing updates on the same row.
 */
export function mergeRestockLines(lines: readonly RestockLine[]): RestockLine[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.inventoryItemId) continue;
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) continue;
    totals.set(line.inventoryItemId, (totals.get(line.inventoryItemId) ?? 0) + line.quantity);
  }

  return [...totals.entries()]
    .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }))
    .sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId));
}

/**
 * Add a received return's resellable units back to stock exactly once, inside the caller's
 * transaction. The caller is expected to hold a lock on the `return_request` row; the
 * `restocked_at` compare-and-set below keeps the guarantee even when it does not.
 */
export async function restockReturn(
  trx: Knex,
  input: RestockInput,
): Promise<RestockOutcome> {
  const lines = mergeRestockLines(input.lines);

  if (lines.length === 0) {
    return {
      restocked: false,
      reason: "nothing_to_restock",
      locationId: input.locationId,
      units: 0,
      skipped: [],
    };
  }

  const skipped: RestockOutcome["skipped"] = [];
  let units = 0;

  for (const line of lines) {
    const outcome = await applyStockDelta(
      trx,
      {
        inventoryItemId: line.inventoryItemId,
        locationId: input.locationId,
        delta: line.quantity,
        reason: "return_restock",
      },
      {
        ...input.audit,
        reference: input.displayId ? `RMA ${input.displayId}` : null,
      },
    );

    if (outcome.ok) {
      units += line.quantity;
    } else {
      skipped.push({ inventoryItemId: line.inventoryItemId, reason: outcome.code });
    }
  }

  if (units === 0) {
    // Nothing was added (no usable inventory level), so the return is not marked as restocked
    // and a later correction can still restock it.
    return {
      restocked: false,
      reason: "nothing_to_restock",
      locationId: input.locationId,
      units: 0,
      skipped,
    };
  }

  const [marked] = (await trx("return_request")
    .where({ id: input.returnRequestId })
    .whereNull("restocked_at")
    .update({ restocked_at: new Date(), updated_at: new Date() })
    .returning("id")) as { id: string }[];

  if (!marked) {
    // Another transaction already restocked this return. Throwing rolls back the increments
    // above, so the units are never added twice.
    throw new ReturnAlreadyRestockedError(input.returnRequestId);
  }

  return {
    restocked: true,
    reason: "restocked",
    locationId: input.locationId,
    units,
    skipped,
  };
}

export class ReturnAlreadyRestockedError extends Error {
  override name = "ReturnAlreadyRestockedError";

  constructor(returnRequestId: string) {
    super(`Return ${returnRequestId} has already been restocked.`);
  }
}
