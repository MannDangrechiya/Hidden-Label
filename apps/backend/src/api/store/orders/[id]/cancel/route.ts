import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows";
import { actorId } from "../../../../../lib/auth";
import { requestMeta, writeAudit } from "../../../../../lib/audit";

interface CancelBody {
  reason?: string;
}

/**
 * POST /store/orders/:id/cancel — customer self-service order cancellation before dispatch.
 */
export async function POST(
  req: MedusaRequest<CancelBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to cancel your order." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const orderId = req.params.id;

  const order = await pg("order")
    .where({ id: orderId, customer_id: customerId })
    .whereNull("deleted_at")
    .first();

  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  if (order.status === "canceled") {
    res.status(422).json({ type: "invalid_state", message: "This order is already cancelled." });
    return;
  }

  // Check if fulfilled
  const fulfillments = await pg("order_fulfillment")
    .where({ order_id: orderId });

  if (fulfillments.length > 0 || order.fulfillment_status === "fulfilled" || order.fulfillment_status === "shipped") {
    res.status(422).json({
      type: "invalid_state",
      message: "This order has already been fulfilled or dispatched and cannot be cancelled directly. You may request a return upon delivery.",
    });
    return;
  }

  const reason = req.body?.reason || "Customer requested cancellation";

  try {
    await cancelOrderWorkflow(req.scope).run({ input: { order_id: orderId } });

    const meta = requestMeta(req);
    await writeAudit(pg, {
      actorType: "customer",
      actorId: customerId,
      action: "order.customer_cancel",
      entityType: "order",
      entityId: orderId,
      summary: `Order ${order.display_id} cancelled by customer. Reason: ${reason}`,
      changes: { reason },
      ...meta,
    });

    const refreshed = await pg("order").where({ id: orderId }).first("id", "display_id", "status");
    res.json({ success: true, order: refreshed });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error(`Order customer cancellation failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(422).json({
      type: "action_failed",
      message: error instanceof Error ? error.message : "Could not cancel the order.",
    });
  }
}
