import { NextResponse } from "next/server";
import { fetchProducts } from "../../../../../lib/api/products";
import { requireSessionToken } from "../../../../../lib/backend";
import { toCsv } from "../../../../../lib/csv";

/** A-15 — CSV export of products, built from data already available via /admin/products. */
export async function GET() {
  await requireSessionToken();

  const rows: (string | number)[][] = [];
  let offset = 0;
  const limit = 100;
  // 2,000-product ceiling keeps this a bounded, synchronous export rather than a background job
  // — a genuine aggregation/queue system is out of scope for v1 (agent/RULES.md §7 scope rule).
  for (let page = 0; page < 20; page += 1) {
    const result = await fetchProducts({ offset, limit });
    for (const product of result.products) {
      const stock = (product.variants ?? []).reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0);
      rows.push([product.id, product.title, product.handle, product.status, product.variants?.length ?? 0, stock]);
    }
    offset += limit;
    if (offset >= result.count) break;
  }

  const csv = toCsv(["id", "title", "handle", "status", "variants", "stock"], rows);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
