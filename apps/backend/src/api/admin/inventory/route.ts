import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../lib/audit";
import { requireRole } from "../../../lib/admin-auth";

interface AdjustBody {
  inventory_item_id?: string;
  location_id?: string;
  delta?: number;
  reason?: string;
}

export const ADJUST_REASONS = [
  "count_correction",
  "stock_count",
  "damaged",
  "lost",
  "return_restock",
  "sample",
  "transfer",
] as const;

/** GET /admin/inventory?low=true — stock on hand with the linked variant. */
export async function GET(
  req: MedusaRequest<unknown, { low?: string; limit?: string }>,
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 300);

  const base = pg("inventory_level as il")
    .join("inventory_item as ii", "ii.id", "il.inventory_item_id")
    .leftJoin("product_variant_inventory_item as pvi", "pvi.inventory_item_id", "ii.id")
    .leftJoin("product_variant as pv", "pv.id", "pvi.variant_id")
    .leftJoin("product as p", "p.id", "pv.product_id")
    .whereNull("ii.deleted_at");

  if (req.query.low === "true") {
    base.whereRaw("(il.stocked_quantity - il.reserved_quantity) <= 3");
  }

  const levels = await base.orderBy("p.title", "asc").limit(limit).select(
    "il.id",
    "il.inventory_item_id",
    "il.location_id",
    "il.stocked_quantity",
    "il.reserved_quantity",
    "ii.sku",
    "ii.title as item_title",
    "pv.id as variant_id",
    "pv.title as variant_title",
    "p.id as product_id",
    "p.title as product_title",
  );

  res.setHeader("Cache-Control", "no-store");
  res.json({
    levels: levels.map((level: Record<string, unknown>) => ({
      ...level,
      available: Number(level.stocked_quantity) - Number(level.reserved_quantity),
    })),
  });
}

/**
 * POST /admin/inventory — adjust stock. A reason code is mandatory, the resulting quantity can
 * never be negative, and the adjustment and its audit row commit together.
 */
export async function POST(req: MedusaRequest<AdjustBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const body = req.body ?? {};
  const delta = Number(body.delta);

  if (!body.inventory_item_id || !body.location_id || !Number.isInteger(delta) || delta === 0) {
    res.status(400).json({ type: "invalid_data", message: "An item, location and non-zero delta are required." });
    return;
  }

  if (!body.reason || !ADJUST_REASONS.includes(body.reason as (typeof ADJUST_REASONS)[number])) {
    res.status(400).json({
      type: "invalid_data",
      message: `A reason code is required: ${ADJUST_REASONS.join(", ")}.`,
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const level = await pg("inventory_level")
    .where({ inventory_item_id: body.inventory_item_id, location_id: body.location_id })
    .first();

  if (!level) {
    res.status(404).json({ type: "not_found", message: "Inventory level not found." });
    return;
  }

  const next = Number(level.stocked_quantity) + delta;
  if (next < 0) {
    res.status(422).json({
      type: "invalid_data",
      message: `Adjusting by ${delta} would leave a negative quantity (${next}).`,
    });
    return;
  }

  const updated = await pg.transaction(async (trx) => {
    const [row] = await trx("inventory_level")
      .where({ id: level.id })
      .update({ stocked_quantity: next, updated_at: new Date() })
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "inventory.adjusted",
      entityType: "inventory_item",
      entityId: body.inventory_item_id ?? "",
      summary: `Stock adjusted by ${delta > 0 ? "+" : ""}${delta} (${body.reason})`,
      changes: { before: Number(level.stocked_quantity), after: next, reason: body.reason },
      ...meta,
    });

    return row;
  });

  res.json({ level: updated, available: next - Number(updated.reserved_quantity) });
}
