import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { computeInclusiveGst, gstStateCode, hsnForProduct } from "@thl/shared";
import { getCurrentCustomer } from "@/lib/session";
import { fetchOrder, type StoreOrderItem } from "@/lib/medusa";
import { PrintButton } from "./invoice-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Tax Invoice THL-${id} — The Hidden Label` };
}

export default async function OrderInvoicePage({ params }: PageProps) {
  const session = await getCurrentCustomer().catch(() => null);
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await fetchOrder(id);

  if (!order || order.customer_id !== session.customer.id) notFound();

  const invoiceNo = `INV-THL-${order.display_id}`;
  const invoiceDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const addr = order.shipping_address;
  const items = order.items ?? [];

  /*
   * GAP-TAX-02/GAP-TAX-03/GAP-TAX-05: the invoice is generated from the business's registered
   * identity and the real place of supply. A supply whose destination state differs from the
   * supplier's state is IGST; only an intra-state supply splits into CGST + SGST.
   */
  const sellerStateCode = process.env.BUSINESS_STATE_CODE ?? "24";
  const sellerStateName = process.env.BUSINESS_STATE_NAME ?? "Gujarat";
  const sellerGstin = process.env.BUSINESS_GSTIN ?? "";
  const sellerLegalName = process.env.BUSINESS_LEGAL_NAME ?? "The Hidden Label Luxury Retail Pvt Ltd";
  const sellerAddress =
    process.env.BUSINESS_ADDRESS ?? "Steller, 205, 2nd Floor, Sindhu Bhavan Road, Bodakdev, Ahmedabad, Gujarat 380059, India";

  const buyerStateCode = gstStateCode(addr?.province) ?? null;
  const gst = computeInclusiveGst({
    totalInclusive: order.total,
    sellerStateCode,
    buyerState: addr?.province ?? sellerStateName,
    actualTaxTotal: order.tax_total,
  });

  const paymentMode =
    order.payment_status === "captured" || order.payment_status === "authorized"
      ? "Prepaid — online payment"
      : "Prepaid — settled with order";

  function hsnForItem(item: StoreOrderItem): string {
    const fromLine = item.metadata?.hsn;
    if (typeof fromLine === "string" && fromLine.trim()) return fromLine;
    const fromProduct = item.product?.metadata?.hsn;
    if (typeof fromProduct === "string" && fromProduct.trim()) return fromProduct;
    const gender = item.product?.metadata?.gender;
    return hsnForProduct(
      item.product_title ?? item.title,
      typeof gender === "string" ? gender : null,
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop font-sans text-ink">
      <div className="print:hidden mb-6 flex items-center justify-between border-b border-line pb-4">
        <Link
          href={`/account/orders/${order.id}`}
          className="font-mono text-label-caps uppercase text-muted hover:text-ink"
        >
          ← Back to Order
        </Link>
        <PrintButton />
      </div>

      <div className="border border-line bg-surface p-6 sm:p-10 shadow-sm print:border-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wider text-ink font-bold">
              The Hidden Label
            </h1>
            <p className="font-mono text-xs text-muted uppercase mt-1">Omnichannel Luxury Boutique</p>
            <p className="mt-2 text-xs text-on-surface-variant max-w-xs leading-relaxed">
              {sellerLegalName}<br />
              {sellerAddress}<br />
              <strong>GSTIN:</strong> {sellerGstin || "Registration not configured"}<br />
              {process.env.BUSINESS_CIN ? (
                <>
                  <strong>CIN:</strong> {process.env.BUSINESS_CIN}<br />
                </>
              ) : null}
              <strong>State Code:</strong> {sellerStateCode} ({sellerStateName})
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block border border-ink bg-ink text-white px-3 py-1 font-mono text-xs uppercase tracking-widest font-semibold mb-3">
              Tax Invoice
            </span>
            <p className="font-mono text-xs text-muted"><strong>Invoice No:</strong> {invoiceNo}</p>
            <p className="font-mono text-xs text-muted"><strong>Date:</strong> {invoiceDate}</p>
            <p className="font-mono text-xs text-muted"><strong>Order ID:</strong> THL-{order.display_id}</p>
            <p className="font-mono text-xs text-muted"><strong>Payment Mode:</strong> {paymentMode}</p>
          </div>
        </div>

        {/* Bill To & Ship To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-line text-xs">
          <div>
            <h2 className="font-mono text-label-caps uppercase text-muted mb-2 font-semibold">Billed To / Buyer</h2>
            <p className="font-semibold text-ink">
              {addr ? `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim() : session.customer.email}
            </p>
            <p className="text-on-surface-variant mt-1">
              {addr?.address_1}{addr?.address_2 ? `, ${addr.address_2}` : ""}<br />
              {addr?.city}, {addr?.province} — {addr?.postal_code}<br />
              India<br />
              Phone: {addr?.phone ?? "N/A"}<br />
              Email: {order.email ?? session.customer.email}
            </p>
          </div>
          <div>
            <h2 className="font-mono text-label-caps uppercase text-muted mb-2 font-semibold">Shipping Destination</h2>
            <p className="font-semibold text-ink">
              {addr ? `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim() : session.customer.email}
            </p>
            <p className="text-on-surface-variant mt-1">
              {addr?.address_1}{addr?.address_2 ? `, ${addr.address_2}` : ""}<br />
              {addr?.city}, {addr?.province} — {addr?.postal_code}<br />
              Place of Supply: {addr?.province ?? sellerStateName} (State Code: {buyerStateCode ?? sellerStateCode})
            </p>
          </div>
        </div>

        {/* Item Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line font-mono text-label-caps uppercase text-muted bg-surface-container/30">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Description of Goods</th>
                <th className="py-2.5 px-3">HSN Code</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Total (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="py-3 px-3 font-mono">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-ink">{item.product_title ?? item.title}</p>
                    {item.variant_title && (
                      <p className="font-mono text-[11px] text-muted">{item.variant_title}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono">{hsnForItem(item)}</td>
                  <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                  <td className="py-3 px-3 text-right font-mono">
                    ₹{Number(item.unit_price).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium">
                    ₹{Number(item.total ?? item.unit_price * item.quantity).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Tax Summary */}
        <div className="border-t border-line pt-4 flex flex-col sm:flex-row justify-between gap-6 text-xs">
          <div className="max-w-xs text-muted space-y-1">
            <p className="font-mono text-label-caps uppercase font-semibold text-ink mb-1">
              Tax Summary ({gst.ratePercent}% GST — {gst.intraState ? "intra-state" : "inter-state"})
            </p>
            <p>Taxable Value: ₹{gst.taxable.toLocaleString("en-IN")}</p>
            {gst.intraState ? (
              <>
                <p>CGST ({gst.cgstPercent}%): ₹{gst.cgst.toLocaleString("en-IN")}</p>
                <p>SGST ({gst.sgstPercent}%): ₹{gst.sgst.toLocaleString("en-IN")}</p>
              </>
            ) : (
              <p>IGST ({gst.igstPercent}%): ₹{gst.igst.toLocaleString("en-IN")}</p>
            )}
            <p>Total Tax: ₹{gst.totalTax.toLocaleString("en-IN")}</p>
            <p className="mt-3 text-[11px] italic">
              Every luxury good is checked and certified for authenticity prior to shipment.
            </p>
          </div>

          <div className="w-full sm:w-64 space-y-2">
            <div className="flex justify-between text-muted">
              <span>Subtotal:</span>
              <span className="font-mono">₹{(order.subtotal ?? order.total).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Shipping Charges:</span>
              <span className="font-mono">
                {order.shipping_total ? `₹${order.shipping_total.toLocaleString("en-IN")}` : "Free"}
              </span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-sm font-semibold text-ink">
              <span>Total Amount (INR):</span>
              <span className="font-mono text-base">₹{order.total.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Signatory */}
        <div className="mt-10 pt-6 border-t border-line flex items-end justify-between text-xs text-muted">
          <div>
            <p>Computer generated tax invoice. No signature required.</p>
            <p className="mt-1">For support inquiries: concierge@thehiddenlabel.com</p>
          </div>
          <div className="text-right">
            <p className="font-display uppercase text-ink font-semibold">The Hidden Label</p>
            <p className="font-mono text-[10px] uppercase text-muted">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </main>
  );
}
