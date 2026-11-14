import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../lib/admin-auth";

/** GET /admin/returns?status= — the reverse-logistics queue. */
export async function GET(
  req: MedusaRequest<unknown, { status?: string }>,
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const base = pg("return_request as rr")
    .join("order as o", "o.id", "rr.order_id")
    .whereNull("rr.deleted_at");

  if (req.query.status) base.where("rr.status", req.query.status);

  const rows = await base
    .orderBy("rr.requested_at", "desc")
    .limit(100)
    .select(
      "rr.*",
      "o.display_id as order_display_id",
      "o.email as customer_email",
    );

  res.setHeader("Cache-Control", "no-store");
  res.json({ returns: rows });
}
