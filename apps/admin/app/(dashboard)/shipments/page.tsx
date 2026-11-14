import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { fetchShipments } from "../../../lib/api/shipments";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { CreateShipmentForm } from "./create-shipment-form";

export const metadata: Metadata = { title: "Shipments" };

/** A-11 — Shipping Management. */
export default async function ShipmentsPage() {
  let shipments;
  let canWrite = false;
  try {
    [shipments, canWrite] = await Promise.all([
      fetchShipments(),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "operations")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load shipments.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-headline-lg">Shipments</h1>
        {canWrite ? <CreateShipmentForm /> : null}
      </div>

      {shipments.length === 0 ? (
        <EmptyState title="No shipments yet" description="Shipments appear here once an order is dispatched." />
      ) : (
        <Table
          columns={[
            {
              key: "order",
              header: "Order",
              sticky: true,
              render: (s) => (
                <Link href={`/shipments/${s.id}`} className="text-ink underline">
                  #{s.order_display_id}
                </Link>
              ),
            },
            { key: "provider", header: "Provider", render: (s) => s.provider },
            { key: "courier", header: "Courier", render: (s) => s.courier ?? "—" },
            { key: "awb", header: "AWB", render: (s) => s.awb ?? "—" },
            {
              key: "status",
              header: "Status",
              render: (s) => (
                <StatusChip tone={s.status === "delivered" ? "positive" : s.stale ? "warning" : "neutral"}>
                  {s.status_label}
                  {s.stale ? " (stale)" : ""}
                </StatusChip>
              ),
            },
            {
              key: "updated",
              header: "Last synced",
              render: (s) => (s.last_synced_at ? new Date(s.last_synced_at).toLocaleString("en-IN") : "—"),
            },
          ]}
          rows={shipments}
          rowKey={(s) => s.id}
        />
      )}
    </div>
  );
}
