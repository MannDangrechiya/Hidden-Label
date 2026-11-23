import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows";
import { actorId } from "../../../../../lib/auth";
import { requestMeta, writeAudit } from "../../../../../lib/audit";
import {
  issueCancellationCreditNote,
  refundCapturedPayment,
} from "../../../../../lib/order-refunds";

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

  // Check if bespoke production has commenced
  const bespokeStage = (order.metadata as Record<string, unknown> | null)?.bespoke_stage;
  if (
    typeof bespokeStage === "string" &&
    ["fabric_cutting", "stitching", "qc_passed", "ready_for_pickup"].includes(bespokeStage)
  ) {
    res.status(422).json({
      type: "invalid_state",
      message: `Made-to-measure production is already in progress (${bespokeStage.replace(/_/g, " ")}). Custom-cut garments cannot be cancelled once fabric cutting commences. Please contact our Sindhu Bhavan Road atelier concierge.`,
    });
    return;
  }

  const reason = req.body?.reason || "Customer requested cancellation";

  try {
    await cancelOrderWorkflow(req.scope).run({ input: { order_id: orderId } });

    const meta = requestMeta(req);

    // R-08: a self-service cancellation of a paid order must return the money and issue the GST
    // credit note, not merely flip the status while the payment stays captured.
    const refund = await refundCapturedPayment({
      pg,
      scope: req.scope,
      orderId,
      reason: `order ${order.display_id} cancelled by customer`,
      actorId: customerId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    let creditNote: { id: string; display_id: string } | null = null;
    let creditNoteError: string | null = null;

    if (refund.kind === "refunded" || refund.kind === "already_refunded") {
      try {
        creditNote = await issueCancellationCreditNote(pg, {
          orderId,
          amountPaise: refund.amountPaise,
          actorId: customerId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      } catch (error) {
        creditNoteError =
          error instanceof Error ? error.message : "Credit note could not be issued.";
        req.scope
          .resolve(ContainerRegistrationKeys.LOGGER)
          .warn(`Credit note for cancelled order ${orderId} failed: ${creditNoteError}`);
      }
    }

    await writeAudit(pg, {
      actorType: "customer",
      actorId: customerId,
      action: "order.customer_cancel",
      entityType: "order",
      entityId: orderId,
      summary: `Order ${order.display_id} cancelled by customer. Reason: ${reason}`,
      changes: {
        reason,
        refund: refund.kind,
        refunded_paise:
          refund.kind === "refunded" || refund.kind === "already_refunded"
            ? refund.amountPaise
            : null,
        credit_note: creditNote?.display_id ?? null,
        ...(creditNoteError ? { credit_note_error: creditNoteError } : {}),
      },
      ...meta,
    });

    const refreshed = await pg("order").where({ id: orderId }).first("id", "display_id", "status");
    res.json({
      success: true,
      order: refreshed,
      refund,
      credit_note: creditNote ?? undefined,
      ...(creditNoteError ? { credit_note_error: creditNoteError } : {}),
    });
  } catch (error) {
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error(`Order customer cancellation failed: ${error instanceof Error ? error.message : String(error)}`);
    res.status(422).json({
      type: "action_failed",
      message: error instanceof Error ? error.message : "Could not cancel the order.",
    });
  }
}
