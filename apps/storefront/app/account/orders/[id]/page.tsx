import { Price } from "@thl/ui";
import { moneyFromRupees } from "@thl/shared";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { fetchOrder, fetchOrderShipment } from "@/lib/medusa";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await fetchOrder(id);

  // Ownership is enforced here, not by the (intentionally unauthenticated) Medusa route — a
  // mismatch renders as a normal 404, never a 403 that would confirm the order exists
  // (docs/API_PLAN.md §1).
  if (!order || order.customer_id !== session.customer.id) notFound();

  let shipment: Awaited<ReturnType<typeof fetchOrderShipment>> | null = null;
  try {
    shipment = await fetchOrderShipment(session.token, order.id);
  } catch {
    shipment = null;
  }

  const canReturn = order.status === "completed" || order.fulfillment_status === "delivered";

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-sp-3">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">Order detail</p>
          <h1 className="type-headline-lg mt-2 uppercase">THL-{order.display_id}</h1>
          <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
            Placed {new Date(order.created_at).toLocaleDateString("en-IN")} · {order.status}
          </p>
        </div>
        {canReturn ? (
          <Link
            href={`/account/orders/${order.id}/return`}
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
          >
            Request return
          </Link>
        ) : null}
      </header>

      <div className="grid gap-sp-5 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-sp-3">
          <h2 className="border-b border-line pb-2 font-display text-headline-sm uppercase">Items</h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-line p-0">
            {(order.items ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-12 flex-none bg-surface-container">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-sans text-body-md text-ink">{item.product_title ?? item.title}</span>
                    <span className="font-mono text-label-caps uppercase text-muted">Qty {item.quantity}</span>
                  </div>
                </div>
                <Price value={moneyFromRupees(item.total ?? item.unit_price * item.quantity)} />
              </li>
            ))}
          </ul>

          <h2 className="mt-sp-3 border-b border-line pb-2 font-display text-headline-sm uppercase">Tracking</h2>
          {shipment?.shipment ? (
            <div className="flex flex-col gap-2">
              <p className="font-sans text-body-sm text-on-surface-variant">
                {shipment.shipment.courier ?? "Courier"} · AWB {shipment.shipment.awb ?? "pending"}
                {shipment.shipment.stale ? " · tracking update delayed" : ""}
              </p>
              <ol className="m-0 flex list-none flex-col gap-2 border-l border-line p-0 pl-4">
                {shipment.events.map((event, index) => (
                  <li key={index} className="font-sans text-body-sm text-ink">
                    <span className="font-mono text-label-caps uppercase text-muted">
                      {new Date(event.occurred_at).toLocaleDateString("en-IN")}
                    </span>{" "}
                    {event.label}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="font-sans text-body-sm text-muted">
              No shipment has been created for this order yet.
            </p>
          )}
        </section>

        <aside className="h-fit border border-line p-sp-3">
          <h2 className="mb-sp-3 font-mono text-label-caps uppercase text-muted">Summary</h2>
          <dl className="m-0 flex flex-col gap-2 font-sans text-body-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Subtotal</dt>
              <dd className="m-0">
                <Price value={moneyFromRupees(order.subtotal ?? order.total)} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Shipping</dt>
              <dd className="m-0">
                <Price value={moneyFromRupees(order.shipping_total ?? 0)} />
              </dd>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-3">
              <dt className="font-mono text-label-caps uppercase text-ink">Total</dt>
              <dd className="m-0">
                <Price value={moneyFromRupees(order.total)} size="lg" />
              </dd>
            </div>
          </dl>

          {order.shipping_address ? (
            <div className="mt-sp-3 border-t border-line pt-sp-3">
              <h3 className="mb-2 font-mono text-label-caps uppercase text-muted">Delivery address</h3>
              <address className="not-italic font-sans text-body-sm text-on-surface-variant">
                {order.shipping_address.first_name} {order.shipping_address.last_name}
                <br />
                {order.shipping_address.address_1}
                <br />
                {order.shipping_address.city}, {order.shipping_address.province}{" "}
                {order.shipping_address.postal_code}
              </address>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
