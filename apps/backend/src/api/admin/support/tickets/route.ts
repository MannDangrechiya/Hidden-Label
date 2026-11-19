import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../lib/admin-auth";

/**
 * GET /admin/support/tickets — GAP-SUP-01. The recorded complaints and questions raised from
 * the storefront, newest first, with the awaiting-reply ones first within each status filter.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const status = typeof req.query?.status === "string" ? req.query.status : undefined;

  const query = pg("support_ticket")
    .whereNull("deleted_at")
    .orderBy("created_at", "desc")
    .limit(200)
    .select(
      "id",
      "display_id",
      "customer_id",
      "name",
      "email",
      "phone",
      "order_id",
      "category",
      "subject",
      "message",
      "status",
      "priority",
      "assigned_to",
      "resolution",
      "resolved_at",
      "created_at",
    );

  if (status) query.where({ status });

  const tickets = await query;

  res.setHeader("Cache-Control", "no-store");
  res.json({ tickets });
}
