import type { Metadata } from "next";
import { ErrorState, StatusChip } from "@thl/ui";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { fetchDashboardSummary } from "../../../lib/api/dashboard";
import { fetchReturns } from "../../../lib/api/returns";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Reports" };

/** A-15 — Reports & Analytics: sales, inventory and returns summaries plus CSV export, built
 * entirely from data the existing admin endpoints already return. No new backend aggregation. */
export default async function ReportsPage() {
  let summary;
  let returns;
  try {
    [summary, returns] = await Promise.all([fetchDashboardSummary(), fetchReturns()]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load reports.";
    return <ErrorState message={message} />;
  }

  const returnsByStatus = returns.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-headline-lg">Reports</h1>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Sales</h2>
        <div className="flex flex-wrap gap-6 border border-line bg-surface p-5">
          <div>
            <p className="font-mono text-label-caps uppercase text-muted">Revenue captured</p>
            <p className="font-display text-headline-md">{formatINR(moneyFromRupees(summary.revenue_captured))}</p>
          </div>
          <div>
            <p className="font-mono text-label-caps uppercase text-muted">Revenue refunded</p>
            <p className="font-display text-headline-md">{formatINR(moneyFromRupees(summary.revenue_refunded))}</p>
          </div>
          <div>
            <p className="font-mono text-label-caps uppercase text-muted">Orders</p>
            <p className="font-display text-headline-md">
              {summary.orders_by_status.reduce((sum, row) => sum + row.count, 0)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Inventory</h2>
        <p className="font-sans text-body-sm text-on-surface-variant">
          {summary.low_stock_count} line(s) at or below the low-stock threshold (available quantity ≤ 3).
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Returns</h2>
        {Object.keys(returnsByStatus).length === 0 ? (
          <p className="font-sans text-body-sm text-muted">No returns recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(returnsByStatus).map(([status, count]) => (
              <StatusChip key={status} tone="neutral">
                {status} · {count}
              </StatusChip>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Exports</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/reports/export/products"
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink hover:bg-ink hover:text-white"
          >
            Download products.csv
          </a>
          <a
            href="/reports/export/orders"
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink hover:bg-ink hover:text-white"
          >
            Download orders.csv
          </a>
        </div>
      </section>
    </div>
  );
}
