import { Price } from "@thl/ui";
import { moneyFromRupees } from "@thl/shared";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { fetchOrder, fetchOrderShipment } from "@/lib/medusa";

export const dynamic = "force-dynamic";

/** Mirrors the master-tailor pipeline written by the admin order actions (`bespoke_stage`). */
const BESPOKE_STEPS = [
  { key: "measurements_verified", label: "Measurements verified" },
  { key: "fabric_cutting", label: "Fabric cutting" },
  { key: "stitching", label: "Stitching" },
  { key: "qc_passed", label: "Quality check passed" },
  { key: "ready_for_pickup", label: "Ready for pickup / dispatched" },
] as const;

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

  // Made-to-measure orders only: a ready-to-wear order never shows tailoring steps it will
  // not go through, and an unknown stage renders nothing rather than a broken timeline.
  const bespokeStage = typeof order.metadata?.bespoke_stage === "string" ? order.metadata.bespoke_stage : null;
  const bespokeIndex = BESPOKE_STEPS.findIndex((step) => step.key === bespokeStage);
  const bespokeCurrent = bespokeIndex >= 0 ? BESPOKE_STEPS[bespokeIndex] : null;
  const bespokeUpdatedAt =
    typeof order.metadata?.bespoke_stage_updated_at === "string" ? order.metadata.bespoke_stage_updated_at : null;

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-sp-3">
        <div>
          <p className="font-mono text-label-caps uppercase text-muted">Order detail</p>
          <h1 className="type-headline-lg mt-2 uppercase">THL-{order.display_id}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-sans text-body-sm text-on-surface-variant">
              Placed {new Date(order.created_at).toLocaleDateString("en-IN")}
            </span>
            <span className="text-muted">·</span>
            <span className="inline-flex items-center px-2 py-0.5 font-mono text-label-caps uppercase bg-surface-container text-ink">
              Status: {order.status}
            </span>
            {order.fulfillment_status ? (
              <span className="inline-flex items-center px-2 py-0.5 font-mono text-label-caps uppercase bg-surface-container text-ink">
                Fulfilment: {order.fulfillment_status}
              </span>
            ) : null}
            {order.payment_status ? (
              <span className="inline-flex items-center px-2 py-0.5 font-mono text-label-caps uppercase bg-surface-container text-ink">
                Payment: {order.payment_status}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === "pending" || order.fulfillment_status === "not_fulfilled" ? (
            <Link
              href={`/account/orders/${order.id}/cancel`}
              className="inline-flex min-h-12 items-center justify-center border border-line px-4 py-2 font-mono text-label-caps uppercase tracking-[0.12em] text-muted hover:border-ink hover:text-ink no-underline transition-colors"
            >
              Cancel Order
            </Link>
          ) : null}
          {/* GAP-SUP-01: the FAQ tells customers to use contact options on the order — this is
              the missing destination, with the order reference already filled in. */}
          <Link
            href={`/support?order=THL-${order.display_id}`}
            className="inline-flex min-h-12 items-center justify-center border border-line px-4 py-2 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-surface-container"
          >
            Get help with this order
          </Link>
          <Link
            href={`/account/orders/${order.id}/invoice`}
            className="inline-flex min-h-12 items-center justify-center border border-line px-4 py-2 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-surface-container"
          >
            GST Invoice
          </Link>
          {canReturn ? (
            <Link
              href={`/account/orders/${order.id}/return`}
              className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
            >
              Request return
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-sp-5 lg:grid-cols-[1fr_360px]">
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

          {bespokeCurrent ? (
            <>
              <h2 className="mt-sp-3 border-b border-line pb-2 font-display text-headline-sm uppercase">
                Tailoring
              </h2>
              <div className="flex flex-col gap-2">
                <p className="font-sans text-body-sm text-on-surface-variant">
                  Current stage: {bespokeCurrent.label}
                  {bespokeUpdatedAt
                    ? ` · updated ${new Date(bespokeUpdatedAt).toLocaleDateString("en-IN")}`
                    : ""}
                </p>
                <ol className="m-0 flex list-none flex-col gap-2 border-l border-line p-0 pl-4">
                  {BESPOKE_STEPS.map((step, index) => (
                    <li
                      key={step.key}
                      className={`font-sans text-body-sm ${
                        index < bespokeIndex
                          ? "text-muted line-through"
                          : index === bespokeIndex
                            ? "font-medium text-ink"
                            : "text-muted"
                      }`}
                    >
                      <span className="font-mono text-label-caps uppercase">
                        {index < bespokeIndex ? "Done" : index === bespokeIndex ? "Now" : "Next"}
                      </span>{" "}
                      {step.label}
                    </li>
                  ))}
                </ol>
                {bespokeIndex >= 1 ? (
                  <div className="mt-2 border border-line bg-surface-container/20 p-3 font-sans text-xs text-muted">
                    <p className="font-mono text-label-caps uppercase text-ink font-semibold m-0">
                      Atelier Notice · Production in Progress
                    </p>
                    <p className="mt-1 m-0">
                      Fabric cutting has commenced at our boutique atelier. Made-to-measure garments are custom-cut to your inches and cannot be cancelled or returned once cutting begins. Complimentary alterations are provided for 14 days following delivery.
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

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
              <dd className="m-0 text-right">
                <Price value={moneyFromRupees(order.total)} size="lg" />
                <span className="block font-mono text-[10px] text-muted uppercase tracking-wider">
                  Incl. of all taxes &amp; GST
                </span>
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
