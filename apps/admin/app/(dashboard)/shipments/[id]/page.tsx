import type { Metadata } from "next";
import Link from "next/link";
import { ErrorState, StatusChip } from "@thl/ui";
import { fetchShipment } from "../../../../lib/api/shipments";
import { fetchCurrentAdmin, roleAtLeast } from "../../../../lib/api/auth";
import { BackendError } from "../../../../lib/backend";
import { UpdateShipmentForm } from "./update-shipment-form";

export const metadata: Metadata = { title: "Shipment detail" };

/** A-11 — Shipping Management detail: AWB, dispatch, courier, tracking sync. */
export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  let canWrite = false;
  try {
    [data, canWrite] = await Promise.all([
      fetchShipment(id),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "operations")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this shipment.";
    return <ErrorState message={message} />;
  }

  const { shipment, events } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-headline-lg">
            <Link href={`/orders/${shipment.order_id}`} className="underline">
              Order #{shipment.order_display_id}
            </Link>
          </h1>
          <p className="font-sans text-body-sm text-on-surface-variant">
            {shipment.provider} · {shipment.courier ?? "No courier set"} · AWB {shipment.awb ?? "—"}
          </p>
        </div>
        <StatusChip tone={shipment.status === "delivered" ? "positive" : shipment.stale ? "warning" : "neutral"}>
          {shipment.status_label}
          {shipment.stale ? " (stale)" : ""}
        </StatusChip>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Tracking timeline</h2>
          {events.length === 0 ? (
            <p className="font-sans text-body-sm text-muted">No events recorded yet.</p>
          ) : (
            <ol className="flex flex-col gap-3 border-l border-line pl-4">
              {events.map((event) => (
                <li key={event.id} className="font-sans text-body-sm">
                  <p className="font-mono text-label-caps uppercase text-ink">{event.status.replace(/_/g, " ")}</p>
                  <p className="text-on-surface-variant">{new Date(event.occurred_at).toLocaleString("en-IN")}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Update</h2>
          {canWrite ? (
            <UpdateShipmentForm shipment={shipment} />
          ) : (
            <p className="font-sans text-body-sm text-muted">Read-only — your role cannot update shipments.</p>
          )}
        </div>
      </section>
    </div>
  );
}
