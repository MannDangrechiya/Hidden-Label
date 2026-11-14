import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
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

/**
 * GET /store/return-requests — the signed-in customer's requests only.
 *
 * Not `/store/returns`: Medusa 2.22.7 ships its own `/store/returns` route (order-edit style
 * returns against a fulfillment), and its core middleware (body validator) still runs even when
 * an app route overrides the handler at that path — only the handler is replaced, not the core
 * middleware chain. Colliding here rejected every request with the stock validator's errors
 * before this handler ever ran. This module's RMA flow (return_request/return_item) lives at
 * its own path instead. See docs/BUILD_LOG.md.
 */
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
 * POST /store/return-requests — create an RMA request.
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

  // The order<->fulfillment pivot is the module-link table "order_fulfillment"
  // (@medusajs/link-modules/definitions/order-fulfillment.ts), not "fulfillment_order".
  const delivered = await pg("fulfillment as f")
    .join("order_fulfillment as fo", "fo.fulfillment_id", "f.id")
    .where("fo.order_id", order.id)
    .whereNotNull("f.delivered_at")
    .max("f.delivered_at as delivered_at")
    .first();

  const deliveredAt = delivered?.delivered_at ?? null;
  const fulfillmentStatus = deliveredAt ? "delivered" : "not_fulfilled";

  const lines: { id: string; quantity: number; unit_price: number }[] = [];
  for (const item of body.items) {
    if (!item.order_item_id || !item.quantity || item.quantity <= 0) {
      res.status(400).json({ type: "invalid_data", message: "Each return line needs a quantity." });
      return;
    }

    // `order_item_id` from the storefront is actually the order LINE item id (the `ordli_...`
    // id Medusa's store API exposes as `items[].id`); the row this route tracks returns against
    // is `order_item` (the `orditem_...` per-order-version record with quantity/return
    // counters), found via its `item_id` foreign key. `order_item.unit_price` is null in this
    // Medusa version — the real price lives on `order_line_item` — so the two are joined.
    const row = await pg("order_item as oi")
      .join("order_line_item as oli", "oli.id", "oi.item_id")
      .where({ "oi.item_id": item.order_item_id, "oi.order_id": order.id })
      .first("oi.id", "oi.quantity", "oli.unit_price", "oi.metadata");

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

    // Medusa's bigNumber columns (order_item.quantity) come back as numeric strings.
    const rowQuantity = Number(row.quantity);

    // "delivered" is a *fulfillment* status (Medusa's OrderFulfillmentStatus), never a value of
    // order.status (OrderStatus is pending/completed/draft/archived/canceled/requires_action) —
    // checking order.status here meant no return could ever become eligible. See
    // docs/BUILD_LOG.md.
    const eligibility = checkReturnEligibility({
      orderStatus: fulfillmentStatus,
      deliveredAt,
      itemQuantity: rowQuantity,
      alreadyReturned: Number(already?.total ?? 0),
    });

    if (!eligibility.eligible) {
      res.status(422).json({
        type: "not_eligible",
        message: eligibility.reason ?? "This item is not eligible for a return.",
      });
      return;
    }

    if (item.quantity > rowQuantity) {
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
        // The DML model generates ids in application code (model.id({ prefix: "rma" })); a raw
        // knex insert bypasses that, so it is done explicitly here — the "id" column has no
        // database-level default.
        id: generateEntityId(undefined, "rma"),
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
        id: generateEntityId(undefined, "rmai"),
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
