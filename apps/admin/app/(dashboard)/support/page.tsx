import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState } from "@thl/ui";
import { BackendError } from "../../../lib/backend";
import { fetchSupportTickets } from "../../../lib/api/support";

export const metadata: Metadata = { title: "Support inbox" };

const STATUSES = ["open", "in_progress", "awaiting_customer", "resolved", "closed"];

/** A-21 — Support & grievance inbox (Consumer Protection Rules, 2020). */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let tickets;
  try {
    tickets = await fetchSupportTickets(status);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load support tickets.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-sp-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-sp-3">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">A-21</p>
          <h1 className="type-headline-lg uppercase">Support inbox</h1>
          <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
            Every request is acknowledged within 48 hours and must be resolved within 30 days.
          </p>
        </div>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          <Link
            href="/support"
            className="border border-line px-3 py-1.5 font-mono text-label-caps uppercase text-ink hover:border-ink"
          >
            All
          </Link>
          {STATUSES.map((value) => (
            <Link
              key={value}
              href={`/support?status=${value}`}
              className="border border-line px-3 py-1.5 font-mono text-label-caps uppercase text-muted hover:border-ink hover:text-ink"
            >
              {value.replace(/_/g, " ")}
            </Link>
          ))}
        </nav>
      </header>

      {tickets.length === 0 ? (
        <EmptyState title="No tickets" description="No support requests match this filter yet." />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="border border-line p-sp-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-body-sm font-semibold uppercase text-ink">
                    {ticket.display_id}
                  </span>
                  <span className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
                    {ticket.category}
                  </span>
                  <span
                    className={[
                      "px-2 py-0.5 font-mono text-[10px] uppercase",
                      ticket.priority === "high"
                        ? "bg-error-container text-error"
                        : "bg-surface-container text-ink",
                    ].join(" ")}
                  >
                    {ticket.priority}
                  </span>
                </div>
                <span className="font-mono text-label-caps uppercase text-muted">
                  {ticket.status.replace(/_/g, " ")}
                </span>
              </div>

              <h2 className="mt-2 font-display text-headline-sm uppercase">{ticket.subject}</h2>
              <p className="mt-1 whitespace-pre-line font-sans text-body-sm text-on-surface-variant">
                {ticket.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-2 font-mono text-[11px] uppercase text-muted">
                <span>{ticket.name}</span>
                <a href={`mailto:${ticket.email}`} className="underline">
                  {ticket.email}
                </a>
                {ticket.phone ? <span>{ticket.phone}</span> : null}
                {ticket.order_id ? <span>Order {ticket.order_id}</span> : null}
                <span>{new Date(ticket.created_at).toLocaleString("en-IN")}</span>
              </div>

              {ticket.resolution ? (
                <p className="mt-2 border-l-2 border-ink pl-3 font-sans text-body-sm text-ink">
                  Resolution: {ticket.resolution}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
