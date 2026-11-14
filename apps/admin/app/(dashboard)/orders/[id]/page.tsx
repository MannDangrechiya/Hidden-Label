import type { Metadata } from "next";
import { ErrorState, StatusChip, Table } from "@thl/ui";
import { formatINR, money } from "@thl/shared";
import { fetchOrder } from "../../../../lib/api/orders";
import { fetchCurrentAdmin, roleAtLeast } from "../../../../lib/api/auth";
import { BackendError } from "../../../../lib/backend";
import { OrderActionBar } from "./order-action-bar";

export const metadata: Metadata = { title: "Order detail" };

/** A-08 — Admin Order Detail: line items, action bar, and (A-10) payments/refunds read off the order. */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let order;
  let canAct = false;
  try {
    [order, canAct] = await Promise.all([
      fetchOrder(id),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "operations")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load this order.";
    return <ErrorState message={message} />;
  }

  const payments = (order.payment_collections ?? []).flatMap((pc) => pc.payments ?? []);
  const address = order.shipping_address;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-headline-lg">Order #{order.display_id}</h1>
          <p className="font-sans text-body-sm text-on-surface-variant">
            {order.email ?? order.customer?.email ?? "Guest"} ·{" "}
            {new Date(order.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex gap-3">
          <StatusChip tone="neutral">{order.status}</StatusChip>
          <StatusChip tone="neutral">{order.fulfillment_status}</StatusChip>
          <StatusChip tone="neutral">{order.payment_status}</StatusChip>
        </div>
      </div>

      {canAct ? <OrderActionBar orderId={order.id} /> : null}

      <section>
        <h2 className="mb-3 font-display text-headline-sm">Items</h2>
        <Table
          columns={[
            { key: "title", header: "Item", sticky: true, render: (i) => i.title },
            { key: "qty", header: "Qty", render: (i) => i.quantity, align: "right" },
            { key: "fulfilled", header: "Fulfilled", render: (i) => i.fulfilled_quantity ?? 0, align: "right" },
            { key: "unit", header: "Unit price", render: (i) => formatINR(money(i.unit_price)), align: "right" },
            { key: "total", header: "Total", render: (i) => formatINR(money(i.total)), align: "right" },
          ]}
          rows={order.items}
          rowKey={(i) => i.id}
        />
        <div className="mt-3 flex flex-col items-end gap-1 font-sans text-body-sm">
          <p>Subtotal: {formatINR(money(order.subtotal))}</p>
          <p>Shipping: {formatINR(money(order.shipping_total))}</p>
          <p>Tax: {formatINR(money(order.tax_total))}</p>
          <p className="font-mono text-currency-md">Total: {formatINR(money(order.total))}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-headline-sm">Shipping address</h2>
          {address ? (
            <address className="not-italic font-sans text-body-sm text-on-surface-variant">
              {address.first_name} {address.last_name}
              <br />
              {address.address_1}
              {address.address_2 ? <>, {address.address_2}</> : null}
              <br />
              {address.city}, {address.province} {address.postal_code}
              <br />
              {address.country_code?.toUpperCase()}
              {address.phone ? (
                <>
                  <br />
                  {address.phone}
                </>
              ) : null}
            </address>
          ) : (
            <p className="font-sans text-body-sm text-muted">No shipping address on file.</p>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-display text-headline-sm">Payments &amp; refunds</h2>
          {payments.length === 0 ? (
            <p className="font-sans text-body-sm text-muted">No payment attached to this order.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {payments.map((payment) => (
                <div key={payment.id} className="border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-body-sm">{payment.provider_id}</p>
                    <StatusChip tone={payment.captured_at ? "positive" : payment.canceled_at ? "critical" : "warning"}>
                      {payment.captured_at ? "Captured" : payment.canceled_at ? "Canceled" : "Pending"}
                    </StatusChip>
                  </div>
                  <p className="mt-1 font-mono text-currency-md">{formatINR(money(payment.amount))}</p>
                  {payment.refunds && payment.refunds.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                      {payment.refunds.map((refund) => (
                        <li key={refund.id} className="font-sans text-body-sm text-on-surface-variant">
                          Refunded {formatINR(money(refund.amount))} on{" "}
                          {new Date(refund.created_at).toLocaleDateString("en-IN")}
                          {refund.note ? ` — ${refund.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
