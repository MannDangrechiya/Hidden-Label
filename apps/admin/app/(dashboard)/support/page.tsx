import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState } from "@thl/ui";
import { BackendError } from "../../../lib/backend";
import { fetchSupportTickets } from "../../../lib/api/support";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { SupportTicketList } from "./support-ticket-list";

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
  let canWrite = false;
  try {
    [tickets, canWrite] = await Promise.all([
      fetchSupportTickets(status),
      fetchCurrentAdmin()
        .then((a) => roleAtLeast(a.role, "operations"))
        .catch(() => false),
    ]);
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
        <SupportTicketList initialTickets={tickets} canWrite={canWrite} />
      )}
    </div>
  );
}
