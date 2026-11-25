import { EmptyState, ErrorState } from "@thl/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { listMyReturns, MedusaError, type StoreReturnRequest } from "@/lib/medusa";
import { RETURN_WINDOW_DAYS } from "@/lib/return-window";

export const dynamic = "force-dynamic";
export const metadata = { title: "Returns & Exchanges" };

const STATUS_LABELS: Record<string, string> = {
  requested: "Return Requested",
  approved: "Return Approved",
  in_transit: "In Transit",
  received: "Received at Boutique",
  inspecting: "Authenticity & Quality Inspection",
  refunded: "Refund Processed",
  rejected: "Return Rejected",
  closed: "Closed",
};

export default async function CustomerReturnsPage() {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  let returns: StoreReturnRequest[] = [];
  let error: string | null = null;

  try {
    returns = await listMyReturns(session.token);
  } catch (caught) {
    error = caught instanceof MedusaError ? caught.message : "Could not load return requests.";
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-sp-3">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">Post-Purchase &amp; Care</p>
          <h1 className="type-headline-lg uppercase">Returns &amp; Exchanges</h1>
          <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
            Track RMA status, inspection progress, and refund disbursements.
          </p>
        </div>
        <Link
          href="/account/orders"
          className="border border-line px-4 py-2 font-mono text-label-caps uppercase text-ink hover:border-ink"
        >
          View orders to return
        </Link>
      </header>

      {error ? (
        <ErrorState message={error} />
      ) : returns.length === 0 ? (
        <EmptyState
          title="No returns requested"
          description={`Eligible delivered orders can be submitted for return or size exchange within ${RETURN_WINDOW_DAYS} days of delivery.`}
          action={
            <Link
              href="/account/orders"
              className="mt-2 inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-5 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              View order history
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="flex flex-col gap-4 border border-line bg-surface p-4 transition-colors hover:border-ink sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-body-sm uppercase font-semibold text-ink">
                    RMA: {ret.display_id}
                  </span>
                  <span className="font-mono text-[11px] uppercase text-muted">
                    Order Ref: THL-{ret.order_display_id ?? ret.order_id}
                  </span>
                </div>
                <span className="border border-ink/20 bg-surface-container/40 px-3 py-1 font-mono text-label-caps uppercase text-ink font-medium">
                  {STATUS_LABELS[ret.status] ?? ret.status}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-sans text-xs">
                <div>
                  <span className="font-mono text-label-caps uppercase text-muted block mb-1">Reason</span>
                  <span className="text-ink capitalize">{ret.reason_code.replace(/_/g, " ")}</span>
                  {ret.reason_note && (
                    <p className="mt-1 text-on-surface-variant italic">&ldquo;{ret.reason_note}&rdquo;</p>
                  )}
                </div>
                <div>
                  <span className="font-mono text-label-caps uppercase text-muted block mb-1">Resolution</span>
                  <span className="text-ink capitalize">{ret.resolution.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="font-mono text-label-caps uppercase text-muted block mb-1">Submitted</span>
                  <span className="text-ink">
                    {ret.requested_at ? new Date(ret.requested_at).toLocaleDateString("en-IN") : "—"}
                  </span>
                </div>
                <div>
                  <span className="font-mono text-label-caps uppercase text-muted block mb-1">Refund Status</span>
                  <span className="text-ink">
                    {ret.status === "refunded" ? "Completed" : ret.status === "approved" ? "Scheduled upon receipt" : "Pending Inspection"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                <Link
                  href={`/account/orders/${ret.order_id}`}
                  className="font-mono text-label-caps uppercase text-ink underline-offset-4 hover:underline"
                >
                  View associated order →
                </Link>
                <span className="font-mono text-[10px] uppercase text-muted">
                  Sindhu Bhavan Road Boutique Logistics
                </span>
              </div>

            </div>
          ))}
        </div>
      )}
    </main>
  );
}
