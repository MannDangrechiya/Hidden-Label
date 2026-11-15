import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/session";
import { fetchOrder } from "@/lib/medusa";
import { CancelOrderForm } from "./cancel-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Cancel Order ${id} — The Hidden Label` };
}

export default async function CancelOrderPage({ params }: PageProps) {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await fetchOrder(id);

  if (!order || order.customer_id !== session.customer.id) notFound();

  const isCancelled = order.status === "canceled";
  const isDispatched =
    order.fulfillment_status === "fulfilled" ||
    order.fulfillment_status === "shipped" ||
    order.fulfillment_status === "delivered";

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 border-b border-line pb-sp-3">
        <Link
          href={`/account/orders/${order.id}`}
          className="font-mono text-label-caps uppercase text-muted hover:text-ink mb-2 inline-block"
        >
          ← Back to Order THL-{order.display_id}
        </Link>
        <h1 className="type-headline-lg uppercase text-error">Cancel Order THL-{order.display_id}</h1>
        <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
          Orders can be cancelled before warehouse fulfillment and courier dispatch.
        </p>
      </header>

      {isCancelled ? (
        <div className="border border-line bg-surface p-6">
          <p className="font-display text-headline-sm uppercase text-ink">Order already cancelled</p>
          <p className="mt-2 font-sans text-body-sm text-muted">
            This order has already been marked as cancelled. Any refund has been credited to your payment method or offline settlement.
          </p>
          <Link
            href="/account/orders"
            className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink hover:bg-ink hover:text-white"
          >
            Return to order history
          </Link>
        </div>
      ) : isDispatched ? (
        <div className="border border-line bg-surface p-6">
          <p className="font-display text-headline-sm uppercase text-ink">Order already fulfilled</p>
          <p className="mt-2 font-sans text-body-sm text-muted">
            Your order has already entered dispatch with the courier and can no longer be cancelled directly. You can request a return or exchange within 7 days once delivered.
          </p>
          <Link
            href={`/account/orders/${order.id}`}
            className="mt-4 inline-block border border-ink px-4 py-2 font-mono text-label-caps uppercase text-ink hover:bg-ink hover:text-white"
          >
            Track order status
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-2xl">
          <div className="border border-line bg-surface p-4">
            <h2 className="font-mono text-label-caps uppercase text-muted mb-2">Order summary</h2>
            <p className="font-sans text-body-sm text-ink">
              Total Amount: <strong>₹{order.total.toLocaleString("en-IN")}</strong> · Items: {order.items?.length ?? 0}
            </p>
          </div>

          <CancelOrderForm orderId={order.id} orderDisplayId={order.display_id} />
        </div>
      )}
    </main>
  );
}
