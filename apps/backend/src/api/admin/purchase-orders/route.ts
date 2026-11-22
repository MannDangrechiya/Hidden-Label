import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { requireRole } from "../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../lib/audit";

interface CreatePoItem {
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_cost_rupees: number;
}

interface CreatePoBody {
  supplier_id?: string;
  items?: CreatePoItem[];
  notes?: string;
}

/**
 * GET /admin/purchase-orders — List purchase orders (Phase 6).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const pos = await pg("purchase_order as po")
    .join("supplier as s", "s.id", "po.supplier_id")
    .orderBy("po.created_at", "desc")
    .select(
      "po.id",
      "po.display_id",
      "po.supplier_id",
      "s.name as supplier_name",
      "po.status",
      "po.total_cost_rupees",
      "po.notes",
      "po.created_at",
      "po.updated_at",
    );

  res.json({ purchase_orders: pos });
}

/**
 * POST /admin/purchase-orders — Draft a new purchase order with line items.
 */
export async function POST(req: MedusaRequest<CreatePoBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const body = req.body ?? {};
  const supplierId = body.supplier_id;
  const items = body.items ?? [];

  if (!supplierId) {
    res.status(400).json({ type: "invalid_data", message: "supplier_id is required." });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ type: "invalid_data", message: "At least one purchase order item is required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const supplier = await pg("supplier").where({ id: supplierId }).first("id", "name");
  if (!supplier) {
    res.status(404).json({ type: "not_found", message: "Supplier not found." });
    return;
  }

  let totalCost = 0;
  for (const item of items) {
    const qty = Number(item.quantity);
    const cost = Number(item.unit_cost_rupees);
    if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
      res.status(400).json({ type: "invalid_data", message: "Invalid item quantity or unit cost." });
      return;
    }
    totalCost += qty * cost;
  }

  const seqRow = await pg.raw("select nextval('purchase_order_display_seq') as seq");
  const displayId = `PO-THL-${seqRow.rows[0].seq}`;
  const poId = `po_${randomBytes(8).toString("hex")}`;

  await pg.transaction(async (trx) => {
    await trx("purchase_order").insert({
      id: poId,
      display_id: displayId,
      supplier_id: supplierId,
      status: "ordered",
      total_cost_rupees: totalCost,
      notes: body.notes?.trim() || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    for (const item of items) {
      const itemId = `poi_${randomBytes(8).toString("hex")}`;
      await trx("purchase_order_item").insert({
        id: itemId,
        purchase_order_id: poId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        received_quantity: 0,
        unit_cost_rupees: item.unit_cost_rupees,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "purchase_order.create",
    entityType: "purchase_order",
    entityId: poId,
    summary: `Purchase Order ${displayId} created for ${supplier.name} (Total: ₹${totalCost})`,
    changes: { supplier_id: supplierId, total_cost_rupees: totalCost, item_count: items.length },
    ...meta,
  });

  const created = await pg("purchase_order").where({ id: poId }).first();
  const poItems = await pg("purchase_order_item").where({ purchase_order_id: poId });

  res.status(201).json({ purchase_order: created, items: poItems });
}
