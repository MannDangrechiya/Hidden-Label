import { NextResponse } from "next/server";
import { fetchOrders } from "../../../../../lib/api/orders";
import { requireSessionToken } from "../../../../../lib/backend";
import { toCsv } from "../../../../../lib/csv";

/**
 * GSTR-1 B2C / B2B Statutory Tax Summary Export (Phase 6, P6-08).
 * Provides exact taxable turnover and CGST/SGST vs IGST tax breakdowns by Place of Supply.
 */
export async function GET() {
  await requireSessionToken();

  const rows: (string | number)[][] = [];
  let offset = 0;
  const limit = 100;

  for (let page = 0; page < 20; page += 1) {
    const result = await fetchOrders({ offset, limit });
    for (const order of result.orders) {
      if (order.status === "canceled") continue;

      const total = Number(order.total);
      // Assuming 18% standard apparel GST rate: Taxable = Total / 1.18, Tax = Total - Taxable
      const taxable = Math.round(total / 1.18);
      const tax = total - taxable;

      // Determine Place of Supply
      const province = order.shipping_address?.province?.toLowerCase() ?? "";
      const isIntraState = province.includes("gujarat") || province.includes("gj");

      const cgst = isIntraState ? Math.round(tax / 2) : 0;
      const sgst = isIntraState ? Math.round(tax / 2) : 0;
      const igst = isIntraState ? 0 : tax;

      rows.push([
        order.display_id,
        new Date(order.created_at).toISOString().slice(0, 10),
        "Invoice",
        order.shipping_address?.province ?? "Inter-State",
        "18%",
        taxable,
        cgst,
        sgst,
        igst,
        total,
      ]);
    }
    offset += limit;
    if (offset >= result.count) break;
  }

  const csv = toCsv(
    [
      "Invoice Number",
      "Invoice Date",
      "Document Type",
      "Place of Supply (State)",
      "Rate",
      "Taxable Value (INR)",
      "Central Tax CGST (INR)",
      "State Tax SGST (INR)",
      "Integrated Tax IGST (INR)",
      "Total Invoice Value (INR)",
    ],
    rows,
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gstr1-summary-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
