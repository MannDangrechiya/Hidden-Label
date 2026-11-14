import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { formatINR, money } from "@thl/shared";
import { fetchPayments } from "../../../lib/api/payments";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Payments & refunds" };

const LIMIT = 20;

/** A-10 — Payments & Refunds Console. Refunds are initiated from the order detail action bar
 * (A-08), which is where the backend's refund workflow and audit event live; this screen is the
 * cross-order read view. */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const { offset: offsetRaw } = await searchParams;
  const offset = Number(offsetRaw ?? 0) || 0;

  let result;
  try {
    result = await fetchPayments({ offset, limit: LIMIT });
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load payments.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Payments &amp; refunds</h1>

      {result.payments.length === 0 ? (
        <EmptyState title="No payments yet" description="Payments appear here once an order is placed." />
      ) : (
        <>
          <Table
            columns={[
              {
                key: "order",
                header: "Order",
                sticky: true,
                render: (p) =>
                  p.payment_collection?.order ? (
                    <Link href={`/orders/${p.payment_collection.order.id}`} className="text-ink underline">
                      #{p.payment_collection.order.display_id}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              { key: "provider", header: "Provider", render: (p) => p.provider_id },
              { key: "amount", header: "Amount", align: "right", render: (p) => formatINR(money(p.amount)) },
              {
                key: "status",
                header: "Status",
                render: (p) => (
                  <StatusChip tone={p.captured_at ? "positive" : p.canceled_at ? "critical" : "warning"}>
                    {p.captured_at ? "Captured" : p.canceled_at ? "Canceled" : "Pending"}
                  </StatusChip>
                ),
              },
              {
                key: "created_at",
                header: "Created",
                render: (p) => new Date(p.created_at).toLocaleDateString("en-IN"),
              },
            ]}
            rows={result.payments}
            rowKey={(p) => p.id}
          />
          <p className="font-mono text-label-caps uppercase text-muted">
            {offset + 1}–{Math.min(offset + LIMIT, result.count)} of {result.count}
          </p>
        </>
      )}
    </div>
  );
}
