import type { Metadata } from "next";
import { EmptyState, ErrorState, Table } from "@thl/ui";
import { fetchAuditEvents } from "../../../lib/api/audit";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Audit log" };

const LIMIT = 50;

/** A-17 — Audit Log & Activity Stream. Read-only; append-only activity log, not a cryptographic
 * ledger (decision D2). */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity_type?: string; action?: string; actor?: string; offset?: string }>;
}) {
  const { entity_type, action, actor, offset: offsetRaw } = await searchParams;
  const offset = Number(offsetRaw ?? 0) || 0;

  let page;
  try {
    page = await fetchAuditEvents({ entity_type, action, actor, offset, limit: LIMIT });
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load the audit log.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Audit log</h1>
      <p className="font-sans text-body-sm text-muted">{page.note}</p>

      <form action="/audit" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="entity_type"
          defaultValue={entity_type}
          placeholder="Entity type (order, brand…)"
          className="min-w-[200px] border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        />
        <input
          type="text"
          name="action"
          defaultValue={action}
          placeholder="Action prefix (order.refund…)"
          className="min-w-[200px] border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        />
        <input
          type="text"
          name="actor"
          defaultValue={actor}
          placeholder="Actor id"
          className="min-w-[200px] border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        />
        <button
          type="submit"
          className="border border-ink px-6 py-2 font-mono text-label-caps uppercase text-ink hover:bg-ink hover:text-white"
        >
          Filter
        </button>
      </form>

      {page.events.length === 0 ? (
        <EmptyState title="No activity matches this filter" description="Mutations write an audit event in the same transaction as the change." />
      ) : (
        <>
          <Table
            columns={[
              {
                key: "occurred_at",
                header: "When",
                sticky: true,
                render: (e) => new Date(e.occurred_at).toLocaleString("en-IN"),
              },
              { key: "action", header: "Action", render: (e) => e.action },
              { key: "entity", header: "Entity", render: (e) => `${e.entity_type} · ${e.entity_id}` },
              { key: "actor", header: "Actor", render: (e) => `${e.actor_type}${e.actor_id ? ` · ${e.actor_id}` : ""}` },
              { key: "summary", header: "Summary", render: (e) => e.summary },
            ]}
            rows={page.events}
            rowKey={(e) => String(e.id)}
          />
          <p className="font-mono text-label-caps uppercase text-muted">
            {offset + 1}–{Math.min(offset + LIMIT, page.count)} of {page.count}
          </p>
        </>
      )}
    </div>
  );
}
