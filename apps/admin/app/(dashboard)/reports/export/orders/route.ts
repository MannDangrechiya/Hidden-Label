import { NextResponse } from "next/server";
import { fetchOrders } from "../../../../../lib/api/orders";
import { requireSessionToken } from "../../../../../lib/backend";
import { toCsv } from "../../../../../lib/csv";

/** A-15 — CSV export of orders, built from data already available via /admin/orders. */
export async function GET() {
  await requireSessionToken();

  const rows: (string | number)[][] = [];
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 20; page += 1) {
    const result = await fetchOrders({ offset, limit });
    for (const order of result.orders) {
      rows.push([
        order.display_id,
        order.email ?? "",
        order.status,
        order.fulfillment_status,
        order.payment_status,
        (order.total / 100).toFixed(2),
        order.currency_code,
        order.created_at,
      ]);
    }
    offset += limit;
    if (offset >= result.count) break;
  }

  const csv = toCsv(
    ["order", "email", "status", "fulfillment_status", "payment_status", "total", "currency", "created_at"],
    rows,
  );
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
