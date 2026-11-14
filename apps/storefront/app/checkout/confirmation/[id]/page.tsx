import { moneyFromRupees } from "@thl/shared";
import { Price } from "@thl/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchOrder } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmed" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * U-14 Order Confirmed. This screen reads the order back from the backend — it is never shown
 * because the browser merely returned from a payment step (docs/PROJECT_PLAN.md §6). If the
 * order id does not resolve to a real, completed order, this renders 404, not a fake success.
 */
export default async function OrderConfirmationPage({ params }: PageProps) {
  const { id } = await params;
  const order = await fetchOrder(id);
  if (!order) notFound();

  return (
    <main className="mx-auto w-full max-w-page px-margin py-xl sm:px-margin-tablet lg:px-margin-desktop">
      <div className="mx-auto max-w-2xl border border-ink p-lg">
        <p className="font-mono text-label-caps uppercase text-accent">Order confirmed</p>
        <h1 className="type-headline-lg mb-md mt-2 uppercase">THL-{order.display_id}</h1>
        <p className="mb-lg font-sans text-body-md text-on-surface-variant">
          Thank you — we have received your order and will begin preparing it. A confirmation has
          been sent to {order.email}.
        </p>

        <ol className="mb-lg flex flex-wrap gap-4 border-b border-line pb-md font-mono text-label-caps uppercase text-muted">
          <li className="text-ink">Placed</li>
          <li aria-hidden="true">→</li>
          <li>Processing</li>
          <li aria-hidden="true">→</li>
          <li>Shipped</li>
          <li aria-hidden="true">→</li>
          <li>Delivered</li>
        </ol>

        <ul className="m-0 mb-md flex list-none flex-col gap-3 divide-y divide-line p-0">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 pt-3 first:pt-0">
              <span className="font-sans text-body-sm text-ink">
                {item.product_title ?? item.title} × {item.quantity}
              </span>
              <Price value={moneyFromRupees(item.total ?? item.unit_price * item.quantity)} />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="font-mono text-label-caps uppercase text-ink">Total</span>
          <Price value={moneyFromRupees(order.total)} size="lg" />
        </div>

        <div className="mt-lg flex flex-wrap gap-3">
          <Link
            href="/account/orders"
            className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
          >
            View order history
          </Link>
          <Link
            href="/collections/all"
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
