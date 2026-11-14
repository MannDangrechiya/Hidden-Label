import type { Metadata } from "next";
import Link from "next/link";
import { ErrorState, StatusChip, Table } from "@thl/ui";
import { formatINR, money } from "@thl/shared";
import { fetchCustomer } from "../../../../lib/api/customers";
import { fetchCurrentAdmin, roleAtLeast } from "../../../../lib/api/auth";
import { BackendError } from "../../../../lib/backend";
import { NotesForm } from "./notes-form";

export const metadata: Metadata = { title: "Customer detail" };

/** A-09 — Customer Management detail: profile, tier, order history. */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let customer;
  let canWrite = false;
  try {
    [customer, canWrite] = await Promise.all([
      fetchCustomer(id),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "operations")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this customer.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-headline-lg">
          {[customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email}
        </h1>
        <p className="font-sans text-body-sm text-on-surface-variant">{customer.email}</p>
      </div>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Profile</h2>
          <NotesForm customer={customer} canWrite={canWrite} />
        </div>
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Addresses</h2>
          {customer.addresses && customer.addresses.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {customer.addresses.map((a) => (
                <li key={a.id} className="border border-line p-3 font-sans text-body-sm text-on-surface-variant">
                  {a.address_1}, {a.city}, {a.province} {a.postal_code}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-sans text-body-sm text-muted">No addresses on file.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Orders</h2>
        {!customer.orders || customer.orders.length === 0 ? (
          <p className="font-sans text-body-sm text-muted">No orders yet.</p>
        ) : (
          <Table
            columns={[
              {
                key: "id",
                header: "Order",
                sticky: true,
                render: (o) => (
                  <Link href={`/orders/${o.id}`} className="text-ink underline">
                    #{o.display_id}
                  </Link>
                ),
              },
              { key: "status", header: "Status", render: (o) => <StatusChip tone="neutral">{o.status}</StatusChip> },
              { key: "total", header: "Total", align: "right", render: (o) => formatINR(money(o.total)) },
              {
                key: "created_at",
                header: "Placed",
                render: (o) => new Date(o.created_at).toLocaleDateString("en-IN"),
              },
            ]}
            rows={customer.orders}
            rowKey={(o) => o.id}
          />
        )}
      </section>
    </div>
  );
}
