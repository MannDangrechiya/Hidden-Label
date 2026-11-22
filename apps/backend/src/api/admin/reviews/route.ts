import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../lib/admin-auth";

/**
 * GET /admin/reviews — List reviews for moderation queue (Phase 5).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const status = (req.query?.status as string) || undefined;

  let query = pg("product_review").orderBy("created_at", "desc");
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query = query.where({ status });
  }

  const reviews = await query.select(
    "id",
    "product_id",
    "customer_id",
    "rating",
    "title",
    "body",
    "author_name",
    "verified_purchase",
    "status",
    "moderated_by",
    "moderated_at",
    "created_at",
  );

  res.json({ reviews });
}
