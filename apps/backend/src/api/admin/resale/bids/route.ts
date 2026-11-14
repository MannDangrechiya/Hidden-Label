import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../lib/admin-auth";

/**
 * GET /admin/resale/bids — Orderbook overview of buyer bids.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const statusFilter = (req.query as Record<string, string | undefined>)?.status;

  const q = pg("resale_bid as b")
    .join("product_variant as pv", "pv.id", "b.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .join("customer as c", "c.id", "b.buyer_id")
    .whereNull("b.deleted_at")
    .orderBy("b.created_at", "desc")
    .select(
      "b.*",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "c.email as buyer_email",
    );

  if (statusFilter) {
    q.where("b.status", statusFilter);
  }

  const bids = await q;

  res.setHeader("Cache-Control", "no-store");
  res.json({ bids });
}
