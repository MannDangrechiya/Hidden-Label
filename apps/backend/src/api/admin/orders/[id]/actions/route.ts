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

const ACTIONS = ["capture", "fulfill", "cancel", "refund"] as const;
type Action = (typeof ACTIONS)[number];

interface Body {
  action?: Action;
  reason?: string;
  amount?: number;
}

/**
 * POST /admin/orders/:id/actions — capture, fulfil, cancel or refund.
 *
 * Every action calls a Medusa workflow (which owns the state transition and its invariants),
 * records an audit event, and reports the resulting state. Refunds require a reason and use an
 * idempotency key so a retry cannot move money twice.
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
        .select("id", "quantity", "fulfilled_quantity");

      const pending = items
        .map((item: { id: string; quantity: number; fulfilled_quantity: number | null }) => ({
          id: item.id,
          quantity: Number(item.quantity) - Number(item.fulfilled_quantity ?? 0),
        }))
        .filter((item: { quantity: number }) => item.quantity > 0);

      if (pending.length === 0) {
        res.status(422).json({ type: "invalid_data", message: "Every item is already fulfilled." });
        return;
      }

      const location = await pg("stock_location").first("id");
      await createOrderFulfillmentWorkflow(req.scope).run({
        input: {
          order_id: orderId,
          items: pending,
          ...(location ? { location_id: location.id } : {}),
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

      await refundPaymentWorkflow(req.scope).run({
        input: {
          payment_id: payment.id,
          amount: req.body.amount ?? Number(payment.amount),
          note: req.body.reason,
          created_by: actor.id,
          idempotency_key: `order-${orderId}-refund-${Date.now()}`,
        },
      });
    }

    await writeAudit(pg, {
      actorType: "admin",
      actorId: actor.id,
      action: `order.${action}`,
      entityType: "order",
      entityId: orderId,
      summary: `Order ${order.display_id} — ${action} by ${actor.email ?? actor.id}`,
      changes: { reason: req.body?.reason ?? null, amount: req.body?.amount ?? null },
      ...meta,
    });

    const refreshed = await pg("order").where({ id: orderId }).first("id", "display_id", "status");
    res.json({ order: refreshed, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The action failed.";
    res.status(422).json({ type: "action_failed", message });
  }
}
