import type { Metadata } from "next";
import Link from "next/link";
import { Button, EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { formatINR, money } from "@thl/shared";
import { fetchOrders } from "../../../lib/api/orders";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Orders" };

const LIMIT = 20;

const TONE: Record<string, "neutral" | "positive" | "warning" | "critical"> = {
  pending: "neutral",
  completed: "positive",
  canceled: "critical",
  requires_action: "warning",
  not_fulfilled: "neutral",
  fulfilled: "positive",
  partially_fulfilled: "warning",
  shipped: "positive",
  delivered: "positive",
  not_paid: "warning",
  awaiting: "warning",
  captured: "positive",
  refunded: "neutral",
};

/** A-07 — Order Management. */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; offset?: string }>;
}) {
  const { q, status, offset: offsetRaw } = await searchParams;
  const offset = Number(offsetRaw ?? 0) || 0;

  let result;
  try {
    result = await fetchOrders({ q, status, offset, limit: LIMIT });
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load orders.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Orders</h1>

      <form action="/orders" className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search order or email"
          className="min-w-[240px] border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
          <option value="requires_action">Requires action</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {result.orders.length === 0 ? (
        <EmptyState title="No orders match this filter" description="Try clearing the search or status filter." />
      ) : (
        <>
          <Table
            columns={[
              {
                key: "id",
                header: "Order",
                sticky: true,
                render: (o) => (
                  <Link href={`/orders/${o.id}`} className="text-ink underline">
                    #{o.display_id}
                  </Link>
                ),
              },
              { key: "email", header: "Customer", render: (o) => o.email ?? "Guest" },
              {
                key: "status",
                header: "Status",
                render: (o) => <StatusChip tone={TONE[o.status] ?? "neutral"}>{o.status}</StatusChip>,
              },
              {
                key: "fulfillment",
                header: "Fulfillment",
                render: (o) => <StatusChip tone={TONE[o.fulfillment_status] ?? "neutral"}>{o.fulfillment_status}</StatusChip>,
              },
              {
                key: "payment",
                header: "Payment",
                render: (o) => <StatusChip tone={TONE[o.payment_status] ?? "neutral"}>{o.payment_status}</StatusChip>,
              },
              {
                key: "total",
                header: "Total",
                align: "right",
                render: (o) => formatINR(money(o.total)),
              },
              {
                key: "created_at",
                header: "Placed",
                render: (o) => new Date(o.created_at).toLocaleDateString("en-IN"),
              },
            ]}
            rows={result.orders}
            rowKey={(o) => o.id}
          />

          <div className="flex items-center justify-between">
            <p className="font-mono text-label-caps uppercase text-muted">
              {offset + 1}–{Math.min(offset + LIMIT, result.count)} of {result.count}
            </p>
            <div className="flex gap-3">
              <Link
                href={`/orders?offset=${Math.max(0, offset - LIMIT)}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                className={`font-mono text-label-caps uppercase ${offset === 0 ? "pointer-events-none text-line" : "text-ink underline"}`}
              >
                Previous
              </Link>
              <Link
                href={`/orders?offset=${offset + LIMIT}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
                className={`font-mono text-label-caps uppercase ${offset + LIMIT >= result.count ? "pointer-events-none text-line" : "text-ink underline"}`}
              >
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
