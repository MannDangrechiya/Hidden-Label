import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface Params {
  handle: string;
}

/**
 * GET /store/brands/:handle — brand plus a stable, paginated list of live product ids.
 * The storefront joins these ids against /store/products so prices keep the region context and
 * the brand page never duplicates or drops products between pages.
 */
export async function GET(
  req: MedusaRequest<unknown, { limit?: string; offset?: string }> & { params: Params },
  res: MedusaResponse,
) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const limit = Math.min(Number(req.query.limit ?? 24) || 24, 60);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  const brand = await pg("brand")
    .where({ handle: req.params.handle, is_active: true })
    .whereNull("deleted_at")
    .first("id", "handle", "name", "tagline", "description", "hero_url", "logo_url", "country", "partnership_tier");

  if (!brand) {
    res.status(404).json({ type: "not_found", message: "Brand not found." });
    return;
  }

  const base = pg("product_brand as pb")
    .join("product as p", "p.id", "pb.product_id")
    .where("pb.brand_id", brand.id)
    .whereNull("p.deleted_at")
    .andWhere("p.status", "published");

  const countRow = await base.clone().count<{ count: string }[]>("p.id as count");
  const rows = await base
    .clone()
    .select("p.id")
    .orderBy("p.created_at", "desc")
    .limit(limit)
    .offset(offset);

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({
    brand,
    product_ids: rows.map((row: { id: string }) => row.id),
    count: Number(countRow[0]?.count ?? 0),
    offset,
    limit,
  });
}
