import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState, StatusChip, Table } from "@thl/ui";
import { fetchCustomers } from "../../../lib/api/customers";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Customers" };

const LIMIT = 20;

/** A-09 — Customer Management. */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const { q, offset: offsetRaw } = await searchParams;
  const offset = Number(offsetRaw ?? 0) || 0;

  let result;
  try {
    result = await fetchCustomers({ q, offset, limit: LIMIT });
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load customers.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Customers</h1>

      <form action="/customers" className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          className="min-w-[240px] border border-line bg-surface px-3 py-2 font-sans text-body-sm outline-none focus:border-ink"
        />
      </form>

      {result.customers.length === 0 ? (
        <EmptyState title="No customers match this search" description="Try a different name or email." />
      ) : (
        <>
          <Table
            columns={[
              {
                key: "email",
                header: "Customer",
                sticky: true,
                render: (c) => (
                  <Link href={`/customers/${c.id}`} className="text-ink underline">
                    {c.email}
                  </Link>
                ),
              },
              { key: "name", header: "Name", render: (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || "—" },
              { key: "phone", header: "Phone", render: (c) => c.phone ?? "—" },
              { key: "account", header: "Account", render: (c) => (c.has_account ? "Registered" : "Guest") },
              { key: "tier", header: "Tier", render: (c) => String(c.metadata?.tier ?? "—") },
              {
                key: "risk",
                header: "Risk",
                render: (c) => {
                  const flag = c.metadata?.risk_flag;
                  if (flag === "blocked") return <StatusChip tone="critical">Blocked</StatusChip>;
                  if (flag === "watch") return <StatusChip tone="warning">Watch</StatusChip>;
                  return <span className="text-muted">—</span>;
                },
              },
              {
                key: "created_at",
                header: "Joined",
                render: (c) => new Date(c.created_at).toLocaleDateString("en-IN"),
              },
            ]}
            rows={result.customers}
            rowKey={(c) => c.id}
          />
          <p className="font-mono text-label-caps uppercase text-muted">
            {offset + 1}–{Math.min(offset + LIMIT, result.count)} of {result.count}
          </p>
        </>
      )}
    </div>
  );
}
