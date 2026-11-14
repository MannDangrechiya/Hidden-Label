import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../lib/admin-auth";

/**
 * GET /admin/resale/asks — Orderbook overview of seller/consignor asks.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const statusFilter = (req.query as Record<string, string | undefined>)?.status;

  const q = pg("resale_ask as a")
    .join("product_variant as pv", "pv.id", "a.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .join("customer as c", "c.id", "a.seller_id")
    .whereNull("a.deleted_at")
    .orderBy("a.created_at", "desc")
    .select(
      "a.*",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "c.email as seller_email",
    );

  if (statusFilter) {
    q.where("a.status", statusFilter);
  }

  const asks = await q;

  res.setHeader("Cache-Control", "no-store");
  res.json({ asks });
}
