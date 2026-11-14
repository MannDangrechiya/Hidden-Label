import { EmptyState, ErrorState, LoadMore } from "@thl/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { listMyOrders, MedusaError } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order history" };

const PAGE_SIZE = 10;

interface PageProps {
  searchParams: Promise<{ offset?: string; status?: string }>;
}

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Cancelled" },
];

export default async function OrderHistoryPage({ searchParams }: PageProps) {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const { offset: offsetParam, status } = await searchParams;
  const offset = Math.max(Number(offsetParam ?? 0) || 0, 0);

  let orders: Awaited<ReturnType<typeof listMyOrders>>["orders"] = [];
  let count = 0;
  let error: string | null = null;

  try {
    const data = await listMyOrders(session.token, { limit: PAGE_SIZE, offset, status: status || undefined });
    orders = data.orders;
    count = data.count;
  } catch (caught) {
    error = caught instanceof MedusaError ? caught.message : "Could not load your orders.";
  }

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-sp-3 border-b border-line pb-sp-3">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">My acquisitions</p>
          <h1 className="type-headline-lg uppercase">Order history</h1>
        </div>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={filter.value ? `/account/orders?status=${filter.value}` : "/account/orders"}
              className={[
                "border px-3 py-1.5 font-mono text-label-caps uppercase no-underline transition-colors",
                (status ?? "") === filter.value ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-ink hover:text-ink",
              ].join(" ")}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      </header>

      {error ? (
        <ErrorState message={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Your placed orders will appear here."
          action={
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              Shop all
            </Link>
          }
        />
      ) : (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left font-mono text-label-caps uppercase text-muted">
                <th className="py-2 font-normal">Order</th>
                <th className="py-2 font-normal">Date</th>
                <th className="py-2 font-normal">Status</th>
                <th className="py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line">
                  <td className="py-3">
                    <Link href={`/account/orders/${order.id}`} className="font-mono text-body-sm uppercase text-ink underline-offset-4 hover:underline">
                      THL-{order.display_id}
                    </Link>
                  </td>
                  <td className="py-3 font-sans text-body-sm text-on-surface-variant">
                    {new Date(order.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="py-3 font-sans text-body-sm capitalize text-on-surface-variant">{order.status}</td>
                  <td className="py-3 text-right font-mono text-currency-md tabular text-ink">
                    ₹{order.total.toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <LoadMore
            shown={Math.min(offset + orders.length, count)}
            total={count}
            hasMore={offset + orders.length < count}
            action={
              <Link
                href={`/account/orders?offset=${offset + PAGE_SIZE}`}
                className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
              >
                Load more
              </Link>
            }
          />
        </>
      )}
    </main>
  );
}
