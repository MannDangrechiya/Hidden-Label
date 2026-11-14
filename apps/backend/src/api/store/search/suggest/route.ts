import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface Query {
  q?: string;
}

/** GET /store/search/suggest?q= — up to 8 products and brands for the typeahead. */
export async function GET(req: MedusaRequest<unknown, Query>, res: MedusaResponse) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const q = String(req.query.q ?? "").trim();

  if (q.length < 2) {
    res.json({ products: [], brands: [] });
    return;
  }

  const pattern = `%${q}%`;

  const products = await pg("product")
    .whereNull("deleted_at")
    .andWhere("status", "published")
    .andWhere("title", "ilike", pattern)
    .orderBy("created_at", "desc")
    .limit(6)
    .select("id", "title", "handle", "thumbnail");

  const brands = await pg("brand")
    .whereNull("deleted_at")
    .andWhere("is_active", true)
    .andWhere("name", "ilike", pattern)
    .orderBy("sort_order", "asc")
    .limit(4)
    .select("id", "name", "handle");

  res.setHeader("Cache-Control", "public, s-maxage=30");
  res.json({ products, brands });
}
