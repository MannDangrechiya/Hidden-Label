/**
 * Money-moving refunds for order cancellations and approved return refunds.
 *
 * R-08: cancelling a paid order and refunding an accepted return used to be pure status updates —
 * the customer's money stayed with the provider and no GST credit note was issued. This module is
 * the single path both flows use so that:
 *
 *  - the provider refund goes through Medusa's `refundPaymentWorkflow` with the existing
 *    idempotency key machinery (`refund_operation`), so a double click, a retry or a concurrent
 *    request can never move money twice;
 *  - a GST credit note (`generateCreditNote`) is issued for the same amount, and
 *  - the caller gets an explicit outcome instead of a boolean, so it can refuse to mark a return
 *    refunded when the provider rejected the refund.
 *
 * A `no_payment` outcome is not a failure: manual/offline settlements still exist, and the caller
 * records the refund without a provider call.
 */
import type { Knex } from "knex";
import type { MedusaContainer } from "@medusajs/framework/types";
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows";
import { writeAudit } from "./audit";
import { generateCreditNote } from "./credit-notes";
import { toPaise, toRupeesNumber } from "./money";
import {
  claimRefundOperation,
  markRefundOperationCompleted,
  markRefundOperationFailed,
  reclaimFailedRefundOperation,
  refundOperationKey,
} from "./refund-operations";

export type RefundOutcome =
  | { kind: "refunded"; amountPaise: number; refundId: string | null }
  | { kind: "already_refunded"; amountPaise: number; refundId: string | null }
  | { kind: "in_progress"; amountPaise: number }
  | { kind: "no_payment" }
  | { kind: "failed"; amountPaise: number; message: string };

export interface RefundCapturedPaymentInput {
  pg: Knex;
  /** `req.scope` — Medusa's container, needed by `refundPaymentWorkflow`. */
  scope: MedusaContainer;
  orderId: string;
  /** Omit to refund the full captured amount. Clamped to what was actually captured. */
  amountPaise?: number;
  /** Part of the idempotency intent — must be stable across retries, never timestamped. */
  reason: string;
  actorId: string;
  /** Re-open a previously failed attempt with the same intent. */
  allowRetry?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

interface CapturedPaymentRow {
  id: string;
  amount: string | number;
}

/** Latest captured, non-cancelled payment on an order, if any. */
async function findCapturedPayment(
  pg: Knex,
  orderId: string,
): Promise<CapturedPaymentRow | undefined> {
  return (await pg("payment as p")
    .join("order_payment_collection as opc", "opc.payment_collection_id", "p.payment_collection_id")
    .where("opc.order_id", orderId)
    .whereNotNull("p.captured_at")
    .whereNull("p.canceled_at")
    .orderBy("p.created_at", "desc")
    .first("p.id", "p.amount")) as CapturedPaymentRow | undefined;
}

export async function refundCapturedPayment(
  input: RefundCapturedPaymentInput,
): Promise<RefundOutcome> {
  const { pg, scope, orderId, actorId } = input;

  const payment = await findCapturedPayment(pg, orderId);
  if (!payment) return { kind: "no_payment" };

  const capturedPaise = toPaise(payment.amount);
  if (capturedPaise <= 0) {
    return { kind: "failed", amountPaise: 0, message: "The captured payment has no refundable amount." };
  }

  const requestedPaise = input.amountPaise ?? capturedPaise;
  const amountPaise = Math.min(Math.max(requestedPaise, 0), capturedPaise);
  if (amountPaise <= 0) {
    return { kind: "failed", amountPaise: 0, message: "A refund amount greater than zero is required." };
  }

  const amount = toRupeesNumber(amountPaise);
  const intent = { orderId, paymentId: payment.id, amount, reason: input.reason };
  const idempotencyKey = refundOperationKey(intent);

  let claim = await claimRefundOperation(pg, { ...intent, actorId });

  if (!claim.claimed) {
    if (claim.operation.status === "completed") {
      return {
        kind: "already_refunded",
        amountPaise,
        refundId: claim.operation.refund_id,
      };
    }
    if (claim.operation.status === "pending") {
      return { kind: "in_progress", amountPaise };
    }
    if (input.allowRetry !== true) {
      return {
        kind: "failed",
        amountPaise,
        message:
          "A previous refund attempt for this exact intent failed. Check the provider dashboard before retrying.",
      };
    }
    const reclaimed = await reclaimFailedRefundOperation(pg, idempotencyKey);
    if (!reclaimed) return { kind: "in_progress", amountPaise };
    claim = { claimed: true, operation: reclaimed };
  }

  try {
    const result = await refundPaymentWorkflow(scope).run({
      input: {
        payment_id: payment.id,
        amount,
        note: input.reason,
        created_by: actorId,
        idempotency_key: idempotencyKey,
      },
    });

    const produced = (result as unknown as { result?: Array<{ id?: string }> })?.result;
    const refundId = produced?.[0]?.id ?? null;
    await markRefundOperationCompleted(pg, idempotencyKey, refundId);

    await writeAudit(pg, {
      actorType: "system",
      actorId,
      action: "payment.refunded",
      entityType: "order",
      entityId: orderId,
      summary: `Refund of ${amount.toFixed(2)} INR issued via ${payment.id} (${input.reason})`,
      changes: {
        payment_id: payment.id,
        amount,
        reason: input.reason,
        refund_id: refundId,
        idempotency_key: idempotencyKey,
      },
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });

    return { kind: "refunded", amountPaise, refundId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markRefundOperationFailed(pg, idempotencyKey, message);
    return { kind: "failed", amountPaise, message };
  }
}

/**
 * Issues the GST credit note for a cancelled order. Idempotent for cancellations: the credit note
 * table has no natural per-cancellation key, so an existing `cancellation` note for the order is
 * returned instead of issuing a second statutory document.
 */
export async function issueCancellationCreditNote(
  pg: Knex,
  input: {
    orderId: string;
    amountPaise: number;
    actorId: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<{ id: string; display_id: string }> {
  const existing = (await pg("credit_note")
    .where({ order_id: input.orderId, reason: "cancellation" })
    .whereNot({ status: "void" })
    .first("id", "display_id")) as { id: string; display_id: string } | undefined;

  if (existing) return existing;

  const { creditNote } = await generateCreditNote(pg, {
    orderId: input.orderId,
    reason: "cancellation",
    totalRefundPaise: input.amountPaise,
    actorId: input.actorId,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { id: creditNote.id, display_id: creditNote.display_id };
}
