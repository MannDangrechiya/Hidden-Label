import Link from "next/link";
import { EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { fetchDashboardSummary } from "../../lib/api/dashboard";
import { BackendError } from "../../lib/backend";

export const metadata = { title: "Dashboard" };

const ORDER_STATUS_TONE: Record<string, "neutral" | "positive" | "warning" | "critical"> = {
  pending: "warning",
  completed: "positive",
  archived: "neutral",
  canceled: "critical",
  requires_action: "warning",
};

function KpiCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="font-mono text-label-caps uppercase text-muted">{label}</p>
      <p className="mt-1 font-display text-headline-md tabular">{value}</p>
      {hint ? <p className="mt-1 font-sans text-body-sm text-on-surface-variant">{hint}</p> : null}
    </>
  );
  const frame = "flex min-h-[112px] flex-col justify-center border border-line bg-surface p-4 transition-colors";
  return href ? (
    <Link href={href} className={`${frame} no-underline hover:border-ink`}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

interface AttentionItem {
  label: string;
  count: number;
  detail: string;
  href: string;
}

/** A-01 — admin dashboard overview: real queues, labelled periods, links to the records. */
export default async function DashboardPage() {
  let summary;
  try {
    summary = await fetchDashboardSummary();
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load the dashboard.";
    return <ErrorState message={message} />;
  }

  const totalOrders = summary.orders_by_status.reduce((sum, row) => sum + row.count, 0);
  const pendingPayments = (summary.orders_by_status.find((row) => row.status === "pending")?.count ?? 0);

  const attention: AttentionItem[] = [
    {
      label: "Return requests awaiting review",
      count: summary.returns_awaiting_review,
      detail: "Customers asked for a return; a staff decision (approve/reject) is pending.",
      href: "/returns?status=requested",
    },
    {
      label: "Shipments awaiting dispatch",
      count: summary.pending_shipments,
      detail: "Shipments created or with a scheduled pickup but not yet in transit.",
      href: "/shipments",
    },
    {
      label: "Open returns in progress",
      count: Math.max(0, summary.open_returns - summary.returns_awaiting_review),
      detail: "Approved, in transit, received or under inspection.",
      href: "/returns",
    },
    {
      label: "Low-stock inventory levels",
      count: summary.low_stock_count,
      detail: "Available quantity at or below 3 units.",
      href: "/inventory",
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-lg">Overview</h1>
          <p className="font-sans text-body-sm text-on-surface-variant">
            Signed in as {summary.actor.role}. All figures come from live backend queries — nothing
            on this page is sampled or cached.
          </p>
        </div>
      </div>

      {/* Needs attention — only shown when there is actually work waiting. */}
      <section aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="mb-3 font-display text-headline-sm">
          Needs attention
        </h2>
        {attention.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="No return decisions, dispatches, in-progress returns or low-stock alerts right now."
          />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
            {attention.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col justify-between gap-2 border border-line bg-surface p-4 no-underline transition-colors hover:border-ink"
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-headline-md tabular">{item.count}</span>
                      <StatusChip tone="warning">action</StatusChip>
                    </div>
                    <p className="mt-1 font-sans text-body-md text-ink">{item.label}</p>
                    <p className="mt-1 font-sans text-body-sm text-on-surface-variant">{item.detail}</p>
                  </div>
                  <span className="font-mono text-label-caps uppercase text-muted">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* KPI row — lifetime totals and the clearly-labelled rolling 24-hour window. */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="mb-3 font-display text-headline-sm">
          Commerce at a glance
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Orders · last 24 hours"
            value={String(summary.orders_last_24h)}
            hint={`${totalOrders} orders all-time`}
          />
          <KpiCard
            label="Captured · last 24 hours"
            value={formatINR(moneyFromRupees(summary.revenue_captured_last_24h))}
            hint={`${formatINR(moneyFromRupees(summary.revenue_captured))} captured all-time`}
          />
          <KpiCard
            label="Refunded · all-time"
            value={formatINR(moneyFromRupees(summary.revenue_refunded))}
            hint="Sum of all issued refunds"
          />
          <KpiCard
            label="Payments pending"
            value={String(pendingPayments)}
            hint="Orders in `pending` status"
            href="/orders?status=pending"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Orders by status</h2>
        {summary.orders_by_status.length === 0 ? (
          <EmptyState title="No orders yet" description="Orders appear here as soon as the first checkout completes." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {summary.orders_by_status.map((row) => (
              <Link key={row.status} href={`/orders?status=${row.status}`} className="no-underline">
                <StatusChip tone={ORDER_STATUS_TONE[row.status] ?? "neutral"}>
                  {row.status} · {row.count}
                </StatusChip>
              </Link>
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
          <EmptyState title="No orders yet" description="The eight most recent orders will be listed here." />
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
