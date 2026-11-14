import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface Body {
  variant_ids?: string[];
}

/**
 * POST /store/catalog/stock — real availability per variant.
 *
 * Medusa's store product API hides inventory counts, but the UI must disable sold-out sizes with
 * a visible reason instead of guessing. This read exposes quantity only (never cost or location
 * detail) and is derived from inventory levels minus reservations.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const ids = Array.isArray(req.body?.variant_ids) ? req.body.variant_ids.slice(0, 200) : [];

  if (ids.length === 0) {
    res.json({ stock: {} });
    return;
  }

  const rows = await pg("product_variant as v")
    .leftJoin("product_variant_inventory_item as pvi", "pvi.variant_id", "v.id")
    .leftJoin("inventory_level as il", "il.inventory_item_id", "pvi.inventory_item_id")
    .whereIn("v.id", ids)
    .select(
      "v.id as variant_id",
      pg.raw(
        "coalesce(sum(il.stocked_quantity) - sum(il.reserved_quantity), 0)::int as available",
      ),
    )
    .groupBy("v.id");

  const stock: Record<string, { available: number }> = {};
  for (const row of rows as { variant_id: string; available: number }[]) {
    stock[row.variant_id] = { available: Number(row.available) };
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ stock });
}
