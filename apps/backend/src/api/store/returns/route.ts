import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { sendEmail } from "../../../lib/email";
import { checkReturnEligibility } from "../../../lib/returns";
import { THL_MODULE } from "../../../modules/thl";
import { actorId } from "../../../lib/auth";
import type ThlModuleService from "../../../modules/thl/service";

interface ReturnItemInput {
  order_item_id?: string;
  quantity?: number;
}

interface Body {
  order_id?: string;
  items?: ReturnItemInput[];
  reason_code?: string;
  note?: string;
}

/** GET /store/returns — the signed-in customer's requests only. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to view returns." });
    return;
  }

  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const requests = await thl.listReturnRequests(
    { customer_id: customerId },
    { order: { requested_at: "DESC" } },
  );

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ returns: requests });
}

/**
 * POST /store/returns — create an RMA request.
 *
 * Eligibility is computed now and is re-computed at approval by the admin route; the value
 * stored here is never the authority.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to request a return." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const body = req.body ?? {};

  if (!body.order_id || !body.reason_code || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({
      type: "invalid_data",
      message: "An order, a reason and at least one item are required.",
    });
    return;
  }

  const order = await pg("order")
    .where({ id: body.order_id, customer_id: customerId })
    .whereNull("deleted_at")
    .first("id", "display_id", "status", "email");

  if (!order) {
    // 404 for another customer's order: never leak existence.
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  const delivered = await pg("fulfillment as f")
    .join("fulfillment_order as fo", "fo.fulfillment_id", "f.id")
    .where("fo.order_id", order.id)
    .whereNotNull("f.delivered_at")
    .max("f.delivered_at as delivered_at")
    .first();

  const deliveredAt = delivered?.delivered_at ?? null;

  const lines: { id: string; quantity: number; unit_price: number }[] = [];
  for (const item of body.items) {
    if (!item.order_item_id || !item.quantity || item.quantity <= 0) {
      res.status(400).json({ type: "invalid_data", message: "Each return line needs a quantity." });
      return;
    }

    const row = await pg("order_item")
      .where({ id: item.order_item_id, order_id: order.id })
      .first("id", "quantity", "unit_price", "metadata");

    if (!row) {
      res.status(400).json({ type: "invalid_data", message: "An item does not belong to this order." });
      return;
    }

    const already = await pg("return_request as rr")
      .join("return_request_item as ri", "ri.return_request_id", "rr.id")
      .where("rr.order_id", order.id)
      .andWhere("ri.order_item_id", row.id)
      .whereNot("rr.status", "rejected")
      .sum("ri.quantity as total")
      .first();

    const eligibility = checkReturnEligibility({
      orderStatus: order.status,
      deliveredAt,
      itemQuantity: row.quantity,
      alreadyReturned: Number(already?.total ?? 0),
    });

    if (!eligibility.eligible) {
      res.status(422).json({
        type: "not_eligible",
        message: eligibility.reason ?? "This item is not eligible for a return.",
      });
      return;
    }

    if (item.quantity > row.quantity) {
      res.status(400).json({
        type: "invalid_data",
        message: "The return quantity is higher than the purchased quantity.",
      });
      return;
    }

    lines.push({ id: row.id, quantity: item.quantity, unit_price: Number(row.unit_price) });
  }

  const countRow = await pg("return_request").count<{ count: string }[]>("id as count");
  const displayId = `RMA-${1000 + Number(countRow[0]?.count ?? 0) + 1}`;
  const refundAmount = lines.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);

  const created = await pg.transaction(async (trx) => {
    const [request] = await trx("return_request")
      .insert({
        display_id: displayId,
        order_id: order.id,
        customer_id: customerId,
        status: "requested",
        reason_code: body.reason_code,
        reason_note: body.note ?? null,
        resolution: "refund",
        refund_amount: (refundAmount / 100).toFixed(2),
        requested_at: new Date(),
      })
      .returning("*");

    for (const line of lines) {
      await trx("return_request_item").insert({
        return_request_id: request.id,
        order_item_id: line.id,
        quantity: line.quantity,
      });
    }

    await trx("audit_event").insert({
      actor_type: "customer",
      actor_id: customerId,
      action: "return.requested",
      entity_type: "return_request",
      entity_id: request.id,
      summary: `Return ${displayId} requested for order ${order.display_id}`,
      changes: JSON.stringify({ refund_amount: refundAmount, items: lines.length }),
      ip: req.ip ?? null,
    });

    return request;
  });

  if (order.email) {
    await sendEmail({
      to: order.email,
      subject: `Return request ${displayId} received`,
      html: `<p>We have received your return request for order ${order.display_id}.</p><p>Our team will review it and arrange a pickup. You can track it from your account.</p>`,
      text: `We have received your return request for order ${order.display_id}.`,
    });
  }

  res.status(201).json({ return: created });
}
