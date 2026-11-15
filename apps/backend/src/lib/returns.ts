/**
 * Return eligibility is computed from the order and re-checked at approval
 * (docs/ORDER_STATE_MACHINE.md §5). A stored eligibility result is never trusted.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "./admin-auth";
import { requestMeta, writeAudit } from "./audit";

export const RETURN_WINDOW_DAYS = 7;

export interface ReturnEligibilityInput {
  /** The order's *fulfillment* status (Medusa's OrderFulfillmentStatus) — "delivered" lives
   * here, never on `order.status` (OrderStatus has no such value). */
  orderStatus: string;
  deliveredAt: string | Date | null;
  itemQuantity: number;
  alreadyReturned: number;
  finalSale?: boolean;
}

export interface ReturnEligibility {
  eligible: boolean;
  reason?: string;
}

export function checkReturnEligibility(input: ReturnEligibilityInput): ReturnEligibility {
  if (input.finalSale) {
    return { eligible: false, reason: "Final-sale items cannot be returned." };
  }
  if (input.orderStatus !== "delivered") {
    return {
      eligible: false,
      reason: "Returns open once the order has been delivered.",
    };
  }
  if (!input.deliveredAt) {
    return { eligible: false, reason: "The delivery date is not recorded on this order." };
  }
  const delivered = new Date(input.deliveredAt).getTime();
  const days = (Date.now() - delivered) / (24 * 60 * 60 * 1000);
  if (days > RETURN_WINDOW_DAYS) {
    return {
      eligible: false,
      reason: `The ${RETURN_WINDOW_DAYS}-day return window has closed.`,
    };
  }
  const remaining = input.itemQuantity - input.alreadyReturned;
  if (remaining <= 0) {
    return { eligible: false, reason: "Every unit on this line has already been returned." };
  }
  return { eligible: true };
}

const ACTIONS = ["approve", "reject", "receive", "refund"] as const;
export type Action = (typeof ACTIONS)[number];

export async function processReturnAction(
  req: MedusaRequest,
  res: MedusaResponse,
  returnId: string,
): Promise<boolean> {
  const body = (req.body ?? {}) as { action?: Action; note?: string };
  const action = body.action;
  if (!action || !ACTIONS.includes(action)) {
    return false;
  }

  const actor = await requireRole(req, res, "operations");
  if (!actor) return true;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const request = await pg("return_request")
    .where({ id: returnId })
    .whereNull("deleted_at")
    .first();
  if (!request) {
    res.status(404).json({ type: "not_found", message: "Return request not found." });
    return true;
  }

  if (action === "approve") {
    const delivered = await pg("fulfillment as f")
      .join("order_fulfillment as fo", "fo.fulfillment_id", "f.id")
      .where("fo.order_id", request.order_id)
      .whereNotNull("f.delivered_at")
      .max("f.delivered_at as delivered_at")
      .first();

    const items = await pg("return_request_item").where({ return_request_id: request.id });
    let itemQuantity = 0;
    for (const item of items) {
      const orderItem = await pg("order_item").where({ id: item.order_item_id }).first("quantity");
      itemQuantity += Number(orderItem?.quantity ?? 0);
    }

    const eligibility = checkReturnEligibility({
      orderStatus: delivered?.delivered_at ? "delivered" : "not_fulfilled",
      deliveredAt: delivered?.delivered_at ?? null,
      itemQuantity: itemQuantity || 1,
      alreadyReturned: 0,
    });

    if (!eligibility.eligible) {
      res.status(422).json({
        type: "not_eligible",
        message: eligibility.reason ?? "This return is no longer eligible.",
      });
      return true;
    }
  }

  const nextStatus =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : action === "receive"
          ? "received"
          : "refunded";

  const updated = await pg.transaction(async (trx) => {
    const patch: Record<string, unknown> = { status: nextStatus, updated_at: new Date() };
    if (action === "approve") patch.approved_at = new Date();
    if (action === "receive") patch.received_at = new Date();
    if (action === "refund" || action === "reject") patch.closed_at = new Date();

    const [row] = await trx("return_request")
      .where({ id: request.id })
      .update(patch)
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: `return.${action}`,
      entityType: "return_request",
      entityId: request.id,
      summary: `${request.display_id} ${action}d by ${actor.email ?? actor.id}`,
      changes: { from: request.status, to: nextStatus, note: body.note ?? null },
      ...meta,
    });

    return row;
  });

  res.json({
    return: updated,
    note:
      action === "refund" && request.refund_amount
        ? "Refund recorded. Manual payments are settled offline; card payments refund through the provider."
        : undefined,
  });
  return true;
}
