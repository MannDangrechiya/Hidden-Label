import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { fetchReturns, type ReturnStatus } from "../../../lib/api/returns";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Returns" };

const TONE: Record<ReturnStatus, "neutral" | "positive" | "warning" | "critical"> = {
  requested: "warning",
  approved: "neutral",
  in_transit: "neutral",
  received: "neutral",
  inspecting: "warning",
  refunded: "positive",
  rejected: "critical",
  closed: "neutral",
};

/** A-12 — Returns Management. */
export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let returns;
  try {
    returns = await fetchReturns(status);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load returns.";
    return <ErrorState message={message} />;
  }

  const statuses: ReturnStatus[] = [
    "requested",
    "approved",
    "in_transit",
    "received",
    "inspecting",
    "refunded",
    "rejected",
    "closed",
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Returns</h1>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/returns"
          className={`font-mono text-label-caps uppercase ${!status ? "text-ink underline" : "text-muted"}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/returns?status=${s}`}
            className={`font-mono text-label-caps uppercase ${status === s ? "text-ink underline" : "text-muted"}`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {returns.length === 0 ? (
        <EmptyState title="No returns match this filter" description="Return requests appear here once a customer opens one." />
      ) : (
        <Table
          columns={[
            {
              key: "id",
              header: "Return",
              sticky: true,
              render: (r) => (
                <Link href={`/returns/${r.id}`} className="text-ink underline">
                  {r.display_id}
                </Link>
              ),
            },
            { key: "order", header: "Order", render: (r) => `#${r.order_display_id}` },
            { key: "customer", header: "Customer", render: (r) => r.customer_email },
            { key: "reason", header: "Reason", render: (r) => r.reason_code },
            { key: "status", header: "Status", render: (r) => <StatusChip tone={TONE[r.status]}>{r.status}</StatusChip> },
            {
              key: "requested_at",
              header: "Requested",
              render: (r) => new Date(r.requested_at).toLocaleDateString("en-IN"),
            },
          ]}
          rows={returns}
          rowKey={(r) => r.id}
        />
      )}
    </div>
  );
}
