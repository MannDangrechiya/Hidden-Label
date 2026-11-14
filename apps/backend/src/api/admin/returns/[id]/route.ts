import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../../lib/audit";
import { requireRole } from "../../../../lib/admin-auth";
import { checkReturnEligibility } from "../../../../lib/returns";

const ACTIONS = ["approve", "reject", "receive", "refund"] as const;
type Action = (typeof ACTIONS)[number];

interface Body {
  action?: Action;
  note?: string;
}

/**
 * POST /admin/returns/:id — approve | reject | receive | refund.
 * Approval re-checks the eligibility window; the value stored at request time is not trusted.
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

  const request = await pg("return_request")
    .where({ id: req.params.id })
    .whereNull("deleted_at")
    .first();
  if (!request) {
    res.status(404).json({ type: "not_found", message: "Return request not found." });
    return;
  }

  const order = await pg("order")
    .where({ id: request.order_id })
    .first("id", "status", "fulfillment_status", "display_id");

  if (action === "approve") {
    // The order<->fulfillment pivot is the module-link table "order_fulfillment"
    // (@medusajs/link-modules/definitions/order-fulfillment.ts), not "fulfillment_order".
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

    // "delivered" is a *fulfillment* status (Medusa's OrderFulfillmentStatus), never a value of
    // order.status — see docs/BUILD_LOG.md.
    const eligibility = checkReturnEligibility({
      orderStatus: order?.fulfillment_status ?? "not_fulfilled",
      deliveredAt: delivered?.delivered_at ?? null,
      itemQuantity: itemQuantity || 1,
      alreadyReturned: 0,
    });

    if (!eligibility.eligible) {
      res.status(422).json({
        type: "not_eligible",
        message: eligibility.reason ?? "This return is no longer eligible.",
      });
      return;
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
      changes: { from: request.status, to: nextStatus, note: req.body?.note ?? null },
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
}
