import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface CategoryRow {
  id: string;
  name: string;
  handle: string;
  parent_category_id: string | null;
  product_count: string;
}

export interface StoreCategoryNode {
  id: string;
  name: string;
  handle: string;
  product_count: number;
  children: StoreCategoryNode[];
}

/**
 * GET /store/categories — the active, non-internal product-category tree with a published
 * product count per node, for the mega-menu and the admin category tree view's storefront
 * preview. Built from the real `product_category` taxonomy (not the storefront's heuristic
 * `lib/catalog.ts` classification, which is a separate, metadata-driven concern).
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const pg = _req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const rows = (await pg("product_category as pc")
    .whereNull("pc.deleted_at")
    .andWhere("pc.is_active", true)
    .andWhere("pc.is_internal", false)
    .leftJoin("product_category_product as pcp", "pcp.product_category_id", "pc.id")
    .leftJoin("product as p", function join() {
      this.on("p.id", "=", "pcp.product_id").andOnNull("p.deleted_at").andOnVal("p.status", "published");
    })
    .groupBy("pc.id", "pc.name", "pc.handle", "pc.parent_category_id", "pc.rank")
    .orderBy("pc.rank", "asc")
    .select(
      "pc.id",
      "pc.name",
      "pc.handle",
      "pc.parent_category_id",
      pg.raw('count(distinct "p"."id") as product_count'),
    )) as CategoryRow[];

  const nodes = new Map<string, StoreCategoryNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        handle: row.handle,
        product_count: Number(row.product_count ?? 0),
        children: [],
      },
    ]),
  );

  const roots: StoreCategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parent_category_id ? nodes.get(row.parent_category_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  res.setHeader("Cache-Control", "public, s-maxage=60");
  res.json({ categories: roots });
}
