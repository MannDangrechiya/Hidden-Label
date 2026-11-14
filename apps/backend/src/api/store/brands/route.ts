import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface BrandRow {
  id: string;
  handle: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  hero_url: string | null;
  country: string | null;
  partnership_tier: string | null;
  sort_order: number;
  product_count: number;
}

/** GET /store/brands — active brands with live product counts, A–Z index ready. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const brands = (await pg("brand as b")
    .leftJoin("product_brand as pb", "pb.brand_id", "b.id")
    .leftJoin("product as p", function joinProduct() {
      this.on("p.id", "pb.product_id")
        .andOnNull("p.deleted_at")
        .andOnVal("p.status", "=", "published");
    })
    .whereNull("b.deleted_at")
    .andWhere("b.is_active", true)
    .groupBy("b.id")
    .orderBy("b.sort_order", "asc")
    .select(
      "b.id",
      "b.handle",
      "b.name",
      "b.tagline",
      "b.logo_url",
      "b.hero_url",
      "b.country",
      "b.partnership_tier",
      "b.sort_order",
      pg.raw("count(distinct p.id)::int as product_count"),
    )) as BrandRow[];

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({ brands, count: brands.length });
}
