import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorState, StatusChip } from "@thl/ui";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { fetchReturns } from "../../../../lib/api/returns";
import { fetchCurrentAdmin, roleAtLeast } from "../../../../lib/api/auth";
import { BackendError } from "../../../../lib/backend";
import { ReturnActionForm } from "./return-action-form";

export const metadata: Metadata = { title: "Return detail" };

/**
 * A-12 — Returns Management detail. The backend exposes no `GET /admin/returns/:id` (only the
 * list and the action route), so the detail view reads the request out of the same list the
 * index page uses rather than inventing an endpoint.
 */
export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let request;
  let canAct = false;
  try {
    const [returns, actor] = await Promise.all([fetchReturns(), fetchCurrentAdmin()]);
    request = returns.find((r) => r.id === id);
    canAct = roleAtLeast(actor.role, "operations");
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this return.";
    return <ErrorState message={message} />;
  }

  if (!request) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-headline-lg">{request.display_id}</h1>
          <p className="font-sans text-body-sm text-on-surface-variant">
            <Link href={`/orders/${request.order_id}`} className="underline">
              Order #{request.order_display_id}
            </Link>{" "}
            · {request.customer_email}
          </p>
        </div>
        <StatusChip tone="neutral">{request.status}</StatusChip>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-2 border border-line bg-surface p-5 font-sans text-body-sm">
          <p>
            <span className="text-muted">Reason: </span>
            {request.reason_code}
          </p>
          {request.reason_note ? (
            <p>
              <span className="text-muted">Note: </span>
              {request.reason_note}
            </p>
          ) : null}
          <p>
            <span className="text-muted">Resolution: </span>
            {request.resolution}
          </p>
          {request.awb ? (
            <p>
              <span className="text-muted">AWB: </span>
              {request.awb} {request.courier ? `(${request.courier})` : ""}
            </p>
          ) : null}
          {request.refund_amount ? (
            <p>
              <span className="text-muted">Refund amount: </span>
              {formatINR(moneyFromRupees(request.refund_amount))}
            </p>
          ) : null}
          <p>
            <span className="text-muted">Requested: </span>
            {new Date(request.requested_at).toLocaleString("en-IN")}
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-headline-sm">Action</h2>
          {canAct ? (
            <ReturnActionForm request={request} />
          ) : (
            <p className="font-sans text-body-sm text-muted">Read-only — your role cannot act on returns.</p>
          )}
        </div>
      </section>
    </div>
  );
}
