import type { ReactNode } from "react";
import { Button, EmptyState, ErrorState, Input, Select, StatusChip, Table } from "@thl/ui";

/**
 * SYS-01 — Admin Design System (dev-only). The admin "dark ops" treatment is the ink sidebar +
 * bone canvas combination used across the shell — every colour still comes from
 * docs/DESIGN_TOKENS.md (ink, canvas, accent, line); no new values are introduced for admin.
 * Not linked from the dashboard nav and marked noindex.
 */
export const metadata = {
  title: "Admin design system",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10 flex flex-col gap-4">
      <h2 className="border-b border-line pb-2 font-mono text-label-caps uppercase text-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function AdminDesignPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-10 border-b border-ink pb-4">
        <h1 className="font-display text-headline-lg uppercase">THL Admin</h1>
        <p className="font-mono text-label-caps uppercase text-muted">Dark ops palette · status chips</p>
      </header>

      <Section title="Shell">
        <div className="flex h-24 border border-line">
          <div className="flex w-48 items-center justify-center bg-ink font-mono text-label-caps uppercase text-white">
            Sidebar (ink)
          </div>
          <div className="flex flex-1 items-center justify-center bg-canvas font-mono text-label-caps uppercase text-on-surface-variant">
            Content (canvas)
          </div>
        </div>
      </Section>

      <Section title="Status chips">
        <div className="flex flex-wrap gap-3">
          <StatusChip tone="neutral">Pending</StatusChip>
          <StatusChip tone="positive">Captured</StatusChip>
          <StatusChip tone="warning">Low stock</StatusChip>
          <StatusChip tone="critical">Canceled</StatusChip>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Save changes</Button>
          <Button variant="secondary">Cancel</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Saving</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Order ID" placeholder="order_01…" />
          <Select label="Role" defaultValue="support">
            <option value="readonly">readonly</option>
            <option value="support">support</option>
            <option value="operations">operations</option>
            <option value="manager">manager</option>
            <option value="owner">owner</option>
          </Select>
        </div>
      </Section>

      <Section title="Data table">
        <Table
          columns={[
            { key: "order", header: "Order", render: (row: { order: string }) => row.order, sticky: true },
            { key: "status", header: "Status", render: () => <StatusChip tone="positive">Captured</StatusChip> },
          ]}
          rows={[{ order: "#THL-2481" }, { order: "#THL-2482" }]}
          rowKey={(row) => row.order}
        />
      </Section>

      <Section title="Empty & error states">
        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState title="No brands yet" description="Create the first brand to start grouping products." />
          <ErrorState message="Cannot reach the backend. Check that it is running and try again." />
        </div>
      </Section>
    </main>
  );
}
