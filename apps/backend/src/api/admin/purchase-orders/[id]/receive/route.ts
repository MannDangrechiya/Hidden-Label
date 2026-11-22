import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { requireRole } from "../../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../../lib/audit";

interface ReceiveItemInput {
  item_id: string; // purchase_order_item id
  quantity_to_receive: number;
}

interface ReceivePoBody {
  location_id?: string;
  items?: ReceiveItemInput[];
  notes?: string;
}

/**
 * POST /admin/purchase-orders/:id/receive — Receive goods against purchase order lines (Phase 6).
 * Atomically updates inventory levels, logs immutable stock movements, and generates GRN.
 */
export async function POST(
  req: MedusaRequest<ReceivePoBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const poId = req.params.id;
  const body = req.body ?? {};
  const locationId = body.location_id;
  const receiveItems = body.items ?? [];

  if (!locationId) {
    res.status(400).json({ type: "invalid_data", message: "location_id is required for goods receipt." });
    return;
  }

  if (!Array.isArray(receiveItems) || receiveItems.length === 0) {
    res.status(400).json({ type: "invalid_data", message: "At least one item to receive must be specified." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const po = await pg("purchase_order").where({ id: poId }).first();

  if (!po) {
    res.status(404).json({ type: "not_found", message: "Purchase Order not found." });
    return;
  }

  if (po.status === "received" || po.status === "cancelled") {
    res.status(422).json({
      type: "invalid_state",
      message: `Cannot receive items on a purchase order that is already ${po.status}.`,
    });
    return;
  }

  const existingItems = await pg("purchase_order_item").where({ purchase_order_id: poId });
  const itemMap = new Map(existingItems.map((i) => [i.id, i]));

  // Validate quantities before transaction
  for (const input of receiveItems) {
    const item = itemMap.get(input.item_id);
    if (!item) {
      res.status(404).json({ type: "not_found", message: `Item ${input.item_id} not found on this purchase order.` });
      return;
    }
    const qty = Number(input.quantity_to_receive);
    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ type: "invalid_data", message: "Quantity to receive must be a positive integer." });
      return;
    }
    const remaining = Number(item.quantity) - Number(item.received_quantity);
    if (qty > remaining) {
      res.status(422).json({
        type: "over_receipt",
        message: `Cannot receive ${qty} units of item ${input.item_id}. Only ${remaining} remaining on order.`,
      });
      return;
    }
  }

  const grnDisplaySeq = await pg.raw("select nextval('goods_receipt_display_seq') as seq");
  const grnDisplayId = `GRN-THL-${grnDisplaySeq.rows[0].seq}`;
  const grnId = `grn_${randomBytes(8).toString("hex")}`;
  const now = new Date();

  await pg.transaction(async (trx) => {
    // 1. Record Goods Receipt
    await trx("goods_receipt").insert({
      id: grnId,
      display_id: grnDisplayId,
      purchase_order_id: poId,
      received_by: actor.id,
      received_at: now,
      notes: body.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    });

    // 2. Process each received item
    for (const input of receiveItems) {
      const item = itemMap.get(input.item_id);
      if (!item) continue;
      const qty = Number(input.quantity_to_receive);
      const newReceived = Number(item.received_quantity) + qty;

      await trx("purchase_order_item")
        .where({ id: item.id })
        .update({
          received_quantity: newReceived,
          updated_at: now,
        });

      // Find inventory item mapped to variant
      const pvLink = await trx("product_variant_inventory_item")
        .where({ variant_id: item.variant_id })
        .first("inventory_item_id");

      const inventoryItemId = pvLink?.inventory_item_id ?? `inv_${item.variant_id}`;

      // Row-lock inventory level
      const level = await trx("inventory_level")
        .where({ inventory_item_id: inventoryItemId, location_id: locationId })
        .forUpdate()
        .first();

      let currentStock = 0;
      if (!level) {
        // Create initial level if missing
        const levelId = `il_${randomBytes(8).toString("hex")}`;
        await trx("inventory_level").insert({
          id: levelId,
          inventory_item_id: inventoryItemId,
          location_id: locationId,
          stocked_quantity: qty,
          reserved_quantity: 0,
          updated_at: now,
        });
        currentStock = qty;
      } else {
        currentStock = Number(level.stocked_quantity) + qty;
        await trx("inventory_level")
          .where({ id: level.id })
          .update({
            stocked_quantity: currentStock,
            updated_at: now,
          });
      }

      // Record immutable stock movement (P6-04)
      const movementId = `sm_${randomBytes(8).toString("hex")}`;
      await trx("stock_movement").insert({
        id: movementId,
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        delta: qty,
        movement_type: "po_receipt",
        reference_id: poId,
        actor_id: actor.id,
        notes: `Received via ${grnDisplayId}`,
        balance_after: currentStock,
        created_at: now,
      });
    }

    // 3. Update PO overall status
    const allItems = await trx("purchase_order_item").where({ purchase_order_id: poId });
    const allDone = allItems.every((i) => Number(i.received_quantity) >= Number(i.quantity));
    const newPoStatus = allDone ? "received" : "partially_received";

    await trx("purchase_order")
      .where({ id: poId })
      .update({
        status: newPoStatus,
        updated_at: now,
      });
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "purchase_order.receive",
    entityType: "purchase_order",
    entityId: poId,
    summary: `Goods receipt ${grnDisplayId} logged for PO ${po.display_id}`,
    changes: { grn_id: grnId, location_id: locationId, received_items: receiveItems },
    ...meta,
  });

  const updatedPo = await pg("purchase_order").where({ id: poId }).first();
  const updatedItems = await pg("purchase_order_item").where({ purchase_order_id: poId });
  const grn = await pg("goods_receipt").where({ id: grnId }).first();

  res.json({
    purchase_order: updatedPo,
    items: updatedItems,
    goods_receipt: grn,
    message: `Goods receipt ${grnDisplayId} completed successfully.`,
  });
}
