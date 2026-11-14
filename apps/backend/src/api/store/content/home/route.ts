import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * GET /store/content/home — active banners.
 * Scheduling is evaluated by the database clock, never by the client
 * (docs/DATABASE_PLAN.md §4).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const banners = await pg("banner_slot")
    .where({ is_active: true })
    .whereNull("deleted_at")
    .andWhere(function windowOpen() {
      this.whereNull("starts_at").orWhere("starts_at", "<=", pg.fn.now());
    })
    .andWhere(function windowClosed() {
      this.whereNull("ends_at").orWhere("ends_at", ">=", pg.fn.now());
    })
    .orderBy("sort_order", "asc")
    .select(
      "id",
      "placement",
      "image_url",
      "headline",
      "subhead",
      "cta_label",
      "cta_href",
    );

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({ banners });
}
