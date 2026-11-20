import { createHash, randomUUID } from "node:crypto";
import type { Knex } from "knex";

/**
 * A refund operation is identified by what it does, not when it is called.
 *
 * BUG-04: the previous key embedded `Date.now()`, so every retry — including a second click, a
 * double request or a provider retry — produced a different key and could move money twice.
 *
 * The key below is a digest of the fiscal intent `(order, payment, amount, reason)`. Together
 * with the unique index on `refund_operation.idempotency_key`, at most one refund operation can
 * exist per intent. The same key is also handed to Medusa's `refundPaymentWorkflow`, so the
 * workflow and the payment provider see a stable idempotency identity too.
 */

export interface RefundIntent {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
}

export interface RefundOperationRow {
  id: string;
  idempotency_key: string;
  order_id: string;
  payment_id: string;
  amount: string | number;
  reason: string;
  status: "pending" | "completed" | "failed";
  refund_id: string | null;
  error: string | null;
  actor_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export type RefundOperationStatus = RefundOperationRow["status"];

function normaliseReason(reason: string): string {
  return reason.trim().replace(/\s+/g, " ").toLowerCase();
}

export function refundOperationKey(intent: RefundIntent): string {
  const canonical = [
    "thl:refund:v1",
    intent.orderId,
    intent.paymentId,
    String(intent.amount),
    normaliseReason(intent.reason),
  ].join("|");
  return `rfn_${createHash("sha256").update(canonical).digest("hex")}`;
}

export interface ClaimRefundInput extends RefundIntent {
  actorId: string;
}

export interface RefundClaim {
  /** True when this caller created (or re-claimed) the operation and owns the side effect. */
  claimed: boolean;
  operation: RefundOperationRow;
}

/**
 * Claims the refund intent. Returns the existing operation untouched when another request
 * already owns it, so the caller can decide between "already done" and "in progress".
 *
 * The insert is `ON CONFLICT DO NOTHING` against a unique key: under concurrency exactly one
 * caller wins, and no row locking or advisory locks are needed.
 */
export async function claimRefundOperation(
  db: Knex,
  input: ClaimRefundInput,
): Promise<RefundClaim> {
  const idempotencyKey = refundOperationKey(input);

  const [inserted] = await db("refund_operation")
    .insert({
      id: `rfop_${randomUUID()}`,
      idempotency_key: idempotencyKey,
      order_id: input.orderId,
      payment_id: input.paymentId,
      amount: input.amount,
      reason: input.reason,
      status: "pending",
      actor_id: input.actorId,
    })
    .onConflict("idempotency_key")
    .ignore()
    .returning("*");

  if (inserted) return { claimed: true, operation: inserted as RefundOperationRow };

  const existing = (await db("refund_operation")
    .where({ idempotency_key: idempotencyKey })
    .first()) as RefundOperationRow | undefined;

  if (!existing) {
    // The conflicting row vanished between the insert and the read. Treat as unclaimable so the
    // caller never runs a second financial side effect on an unknown state.
    throw new Error("Refund operation conflict could not be resolved.");
  }

  return { claimed: false, operation: existing };
}

/**
 * Re-opens a previously failed operation for a legitimate retry with the same intent. The
 * conditional update means two concurrent retries cannot both win.
 */
export async function reclaimFailedRefundOperation(
  db: Knex,
  idempotencyKey: string,
): Promise<RefundOperationRow | null> {
  const [row] = await db("refund_operation")
    .where({ idempotency_key: idempotencyKey, status: "failed" })
    .update({ status: "pending", error: null, updated_at: new Date() })
    .returning("*");
  return (row as RefundOperationRow | undefined) ?? null;
}

export async function markRefundOperationCompleted(
  db: Knex,
  idempotencyKey: string,
  refundId: string | null,
): Promise<void> {
  await db("refund_operation")
    .where({ idempotency_key: idempotencyKey })
    .update({
      status: "completed",
      refund_id: refundId,
      error: null,
      updated_at: new Date(),
    });
}

export async function markRefundOperationFailed(
  db: Knex,
  idempotencyKey: string,
  error: string,
): Promise<void> {
  await db("refund_operation")
    .where({ idempotency_key: idempotencyKey })
    .update({ status: "failed", error: error.slice(0, 500), updated_at: new Date() });
}
