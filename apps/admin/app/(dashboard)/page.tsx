import type { Metadata } from "next";
import Link from "next/link";
import { ErrorState, StatusChip, Table } from "@thl/ui";
import { formatINR, money } from "@thl/shared";
import { fetchDashboardSummary } from "../../lib/api/dashboard";
import { BackendError } from "../../lib/backend";

export const metadata: Metadata = { title: "Dashboard" };

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 border border-line bg-surface p-5">
      <p className="font-mono text-label-caps uppercase text-muted">{label}</p>
      <p className="font-display text-headline-lg">{value}</p>
      {hint ? <p className="font-sans text-body-sm text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

const ORDER_STATUS_TONE: Record<string, "neutral" | "positive" | "warning" | "critical"> = {
  pending: "neutral",
  completed: "positive",
  archived: "neutral",
  canceled: "critical",
  requires_action: "warning",
};

/** A-01 — admin dashboard overview. */
export default async function DashboardPage() {
  let summary;
  try {
    summary = await fetchDashboardSummary();
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load the dashboard.";
    return <ErrorState message={message} />;
  }

  const totalOrders = summary.orders_by_status.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-headline-lg">Dashboard</h1>
        <p className="font-sans text-body-sm text-on-surface-variant">
          Signed in as {summary.actor.role}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Orders" value={String(totalOrders)} hint="All statuses" />
        <KpiCard label="Revenue captured" value={formatINR(money(summary.revenue_captured))} />
        <KpiCard label="Revenue refunded" value={formatINR(money(summary.revenue_refunded))} />
        <KpiCard
          label="Low stock"
          value={String(summary.low_stock_count)}
          hint="Available quantity ≤ 3"
        />
        <KpiCard label="Open returns" value={String(summary.open_returns)} />
        <KpiCard label="Pending shipments" value={String(summary.pending_shipments)} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Orders by status</h2>
        {summary.orders_by_status.length === 0 ? (
          <p className="font-sans text-body-sm text-muted">No orders yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {summary.orders_by_status.map((row) => (
              <StatusChip key={row.status} tone={ORDER_STATUS_TONE[row.status] ?? "neutral"}>
                {row.status} · {row.count}
              </StatusChip>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-headline-sm">Recent orders</h2>
          <Link href="/orders" className="font-mono text-label-caps uppercase text-ink underline">
            View all
          </Link>
        </div>
        {summary.recent_orders.length === 0 ? (
          <p className="font-sans text-body-sm text-muted">No orders yet.</p>
        ) : (
          <Table
            columns={[
              { key: "id", header: "Order", render: (row) => row.display_id, sticky: true },
              { key: "email", header: "Customer", render: (row) => row.email ?? "Guest" },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <StatusChip tone={ORDER_STATUS_TONE[row.status] ?? "neutral"}>{row.status}</StatusChip>
                ),
              },
              {
                key: "created_at",
                header: "Placed",
                render: (row) => new Date(row.created_at).toLocaleString("en-IN"),
              },
            ]}
            rows={summary.recent_orders}
            rowKey={(row) => row.id}
          />
        )}
      </section>
    </div>
  );
}
