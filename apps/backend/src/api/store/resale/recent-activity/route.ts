import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface ActivityRow {
  product_title: string;
  variant_title: string | null;
  unit_price: string | number;
  created_at: string;
}

/**
 * GET /store/resale/recent-activity
 *
 * D2: real recent order activity only — no fabricated trades, no invented cities, no "live"
 * claim unless the data is actually live. Returns the last few real order lines placed on the
 * store. When there is no real activity yet, the caller must show an honest empty state rather
 * than fake rows (the previous `market-ticker.tsx` hardcoded six invented trades across named
 * Indian cities and labelled them "Live Marketplace Trades" — that was a direct D2 violation
 * and has been removed).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const rows = (await pg("order_line_item as oli")
    .join("order_item as oi", "oi.item_id", "oli.id")
    .join("order as o", "o.id", "oi.order_id")
    .whereNull("oli.deleted_at")
    .whereNotIn("o.status", ["canceled", "draft"])
    .orderBy("oli.created_at", "desc")
    .limit(6)
    .select("oli.product_title", "oli.variant_title", "oli.unit_price", "oli.created_at")) as ActivityRow[];

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  res.json({
    activity: rows.map((r) => ({
      product_title: r.product_title,
      variant_title: r.variant_title,
      unit_price: Number(r.unit_price),
      created_at: r.created_at,
    })),
  });
}
