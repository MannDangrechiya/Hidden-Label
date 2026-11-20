import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  cancelOrderWorkflow,
  capturePaymentWorkflow,
  createOrderFulfillmentWorkflow,
  refundPaymentWorkflow,
} from "@medusajs/medusa/core-flows";
import { requestMeta, writeAudit } from "../../../../../lib/audit";
import { requireRole } from "../../../../../lib/admin-auth";
import {
  claimRefundOperation,
  markRefundOperationCompleted,
  markRefundOperationFailed,
  reclaimFailedRefundOperation,
  refundOperationKey,
} from "../../../../../lib/refund-operations";
import { MoneyParseError, toPaise, toRupeesNumber } from "../../../../../lib/money";
import { resolveStockLocation } from "../../../../../lib/stock-location";

const ACTIONS = ["capture", "fulfill", "cancel", "refund"] as const;
type Action = (typeof ACTIONS)[number];

interface Body {
  action?: Action;
  reason?: string;
  amount?: number;
  /** Explicit operator confirmation required to retry a refund that previously failed. */
  retry?: boolean;
  /** R-07: ship from this location when the business has more than one. */
  location_id?: string;
}

/**
 * POST /admin/orders/:id/actions — capture, fulfil, cancel or refund.
 *
 * Every action calls a Medusa workflow (which owns the state transition and its invariants),
 * records an audit event, and reports the resulting state.
 *
 * Refunds are claimed through `refund_operation` first. The claim key is a digest of
 * `(order, payment, amount, reason)` and is unique in the database, so a duplicate click, a
 * concurrent request or a retry after a network failure resolves to the *same* operation:
 *   - already completed → the existing refund is returned (no second provider call);
 *   - still pending     → 409, the caller is told a refund is already in progress;
 *   - failed            → the same operation is re-opened before retrying.
 * The same stable key is passed to `refundPaymentWorkflow`, so the workflow and provider see a
 * stable idempotency identity as well.
 */
export async function POST(
  req: MedusaRequest<Body> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const action = req.body?.action;
  if (!action || !ACTIONS.includes(action)) {
    res.status(400).json({ type: "invalid_data", message: "A valid action is required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);
  const orderId = req.params.id;

  const order = await pg("order").where({ id: orderId }).whereNull("deleted_at").first();
  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  try {
    if (action === "capture") {
      const payment = await pg("payment as p")
        .join("order_payment_collection as opc", "opc.payment_collection_id", "p.payment_collection_id")
        .where("opc.order_id", orderId)
        .whereNull("p.canceled_at")
        .orderBy("p.created_at", "desc")
        .first("p.id");

      if (!payment) {
        res.status(422).json({ type: "invalid_data", message: "No payment is attached to this order." });
        return;
      }

      await capturePaymentWorkflow(req.scope).run({ input: { payment_id: payment.id } });
    }

    if (action === "fulfill") {
      const items = await pg("order_item")
        .where({ order_id: orderId })
        .whereNull("deleted_at")
        .select("id", "item_id", "quantity", "fulfilled_quantity");

      const pending = items
        .map((item: { id: string; item_id: string; quantity: number; fulfilled_quantity: number | null }) => ({
          id: item.item_id,
          quantity: Number(item.quantity) - Number(item.fulfilled_quantity ?? 0),
        }))
        .filter((item: { quantity: number }) => item.quantity > 0);

      if (pending.length === 0) {
        res.status(422).json({ type: "invalid_data", message: "Every item is already fulfilled." });
        return;
      }

      // R-07: never pick a location with an unordered `first()`. Use the one the order already
      // ships from (or the only location); when several exist and none is known, refuse rather
      // than move stock out of an arbitrary warehouse.
      const decision = await resolveStockLocation(pg, {
        orderId,
        requestedLocationId: req.body?.location_id ?? null,
      });

      if (!decision.ok) {
        res.status(decision.status).json({ type: decision.code, message: decision.message });
        return;
      }

      await createOrderFulfillmentWorkflow(req.scope).run({
        input: {
          order_id: orderId,
          items: pending,
          location_id: decision.locationId,
        },
      });
    }

    if (action === "cancel") {
      if (!req.body?.reason) {
        res.status(400).json({ type: "invalid_data", message: "A cancellation reason is required." });
        return;
      }
      await cancelOrderWorkflow(req.scope).run({ input: { order_id: orderId } });
    }

    if (action === "refund") {
      if (!req.body?.reason) {
        res.status(400).json({ type: "invalid_data", message: "A refund reason is required." });
        return;
      }

      const payment = await pg("payment as p")
        .join("order_payment_collection as opc", "opc.payment_collection_id", "p.payment_collection_id")
        .where("opc.order_id", orderId)
        .whereNotNull("p.captured_at")
        .orderBy("p.created_at", "desc")
        .first("p.id", "p.amount");

      if (!payment) {
        res.status(422).json({
          type: "invalid_data",
          message:
            "No captured payment exists for this order. Manual (pay-on-delivery) payments are refunded offline.",
        });
        return;
      }

      // R-06: `payment.amount` is a numeric string. Converting it straight to a number puts
      // binary floating point into the refund, so both sides are parsed into exact integer paise
      // and a value the column could not hold (e.g. three decimals) is rejected, not rounded.
      let amountPaise: number;
      try {
        amountPaise =
          req.body.amount === undefined
            ? toPaise(payment.amount as string)
            : toPaise(req.body.amount);
      } catch (error) {
        res.status(400).json({
          type: "invalid_data",
          message:
            error instanceof MoneyParseError
              ? "Refund amounts must be a rupee value with at most two decimal places."
              : "A refund amount greater than zero is required.",
        });
        return;
      }

      if (amountPaise <= 0) {
        res.status(400).json({ type: "invalid_data", message: "A refund amount greater than zero is required." });
        return;
      }

      // Medusa's payment workflow takes rupees. This boundary conversion is exact for any
      // 2-decimal amount; all validation above happened in integer paise.
      const amount = toRupeesNumber(amountPaise);

      const intent = {
        orderId,
        paymentId: payment.id as string,
        amount,
        reason: req.body.reason,
      };
      const idempotencyKey = refundOperationKey(intent);

      let claim = await claimRefundOperation(pg, { ...intent, actorId: actor.id });

      if (!claim.claimed) {
        if (claim.operation.status === "completed") {
          const refreshedDuplicate = await pg("order").where({ id: orderId }).first("id", "display_id", "status");
          res.json({
            order: refreshedDuplicate,
            action,
            duplicate: true,
            refund_id: claim.operation.refund_id,
            idempotency_key: idempotencyKey,
          });
          return;
        }

        if (claim.operation.status === "pending") {
          res.status(409).json({
            type: "refund_in_progress",
            message:
              "A refund for this exact amount and reason is already being processed. Retry in a moment — it will not be charged twice.",
            idempotency_key: idempotencyKey,
          });
          return;
        }

        // A failed attempt may have reached the provider before failing locally (for example a
        // timeout after a successful refund call). Retrying is therefore an explicit operator
        // decision, never an automatic side effect of pressing the button again.
        if (req.body.retry !== true) {
          res.status(409).json({
            type: "refund_failed",
            message:
              "A previous refund attempt for this exact amount and reason failed. Check the provider dashboard, then resubmit with retry: true if no refund exists.",
            idempotency_key: idempotencyKey,
          });
          return;
        }

        const reclaimed = await reclaimFailedRefundOperation(pg, idempotencyKey);
        if (!reclaimed) {
          res.status(409).json({
            type: "refund_in_progress",
            message: "A refund for this order is already being processed.",
            idempotency_key: idempotencyKey,
          });
          return;
        }
        claim = { claimed: true, operation: reclaimed };
      }

      let refundId: string | null = null;
      try {
        const result = await refundPaymentWorkflow(req.scope).run({
          input: {
            payment_id: payment.id,
            amount,
            note: req.body.reason,
            created_by: actor.id,
            idempotency_key: idempotencyKey,
          },
        });

        const produced = (result as unknown as { result?: Array<{ id?: string }> })?.result;
        refundId = produced?.[0]?.id ?? null;
        await markRefundOperationCompleted(pg, idempotencyKey, refundId);
      } catch (error) {
        await markRefundOperationFailed(
          pg,
          idempotencyKey,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    }

    await writeAudit(pg, {
      actorType: "admin",
      actorId: actor.id,
      action: `order.${action}`,
      entityType: "order",
      entityId: orderId,
      summary: `Order ${order.display_id} — ${action} by ${actor.email ?? actor.id}`,
      changes: {
        reason: req.body?.reason ?? null,
        amount: req.body?.amount ?? null,
      },
      ...meta,
    });

    const refreshed = await pg("order").where({ id: orderId }).first("id", "display_id", "status");
    res.json({ order: refreshed, action });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error(`Order action ${action} failed: ${error instanceof Error ? error.stack : String(error)}`);
    const message = error instanceof Error ? error.message : "The action failed.";
    res.status(422).json({ type: "action_failed", message });
  }
}
