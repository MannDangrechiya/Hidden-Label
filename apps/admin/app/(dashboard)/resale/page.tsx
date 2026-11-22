import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchAdminResaleAsks, fetchAdminResaleBids } from "../../../lib/api/resale";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Resale Orderbook" };

/** A-19 — Secondary market asks & bids orderbook. */
export default async function ResalePage() {
  let asks;
  let bids;
  try {
    [asks, bids] = await Promise.all([
      fetchAdminResaleAsks(),
      fetchAdminResaleBids(),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load orderbook.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-headline-lg">Resale Orderbook</h1>
        <p className="font-sans text-body-sm text-muted">
          Active consignor asks and buyer bids across all catalog size variants.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Asks Column */}
        <div className="border border-line bg-white p-5">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-mono text-label-caps uppercase text-ink font-semibold">
              Active Asks ({asks.length})
            </h2>
            <span className="font-mono text-xs text-muted">Sellers / Consignors</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b border-line bg-surface-container/40 font-mono text-[10px] uppercase text-muted">
                <tr>
                  <th className="p-2">Product &amp; Size</th>
                  <th className="p-2">Ask (INR)</th>
                  <th className="p-2">Grade</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Seller</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {asks.slice(0, 25).map((ask) => (
                  <tr key={ask.id}>
                    <td className="p-2">
                      <span className="font-medium text-ink block truncate max-w-[180px]">
                        {ask.product_title}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{ask.variant_title}</span>
                    </td>
                    <td className="p-2 font-mono font-semibold text-emerald-800">
                      ₹{Number(ask.ask_price).toLocaleString("en-IN")}
                    </td>
                    <td className="p-2 font-mono text-[11px]">{ask.condition_grade}</td>
                    <td className="p-2">
                      <span className={`inline-block px-1.5 py-0.5 font-mono text-[10px] uppercase rounded ${
                        ask.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : ask.status === "authenticated"
                          ? "bg-blue-50 text-blue-700 border border-blue-300"
                          : ask.status === "sold"
                          ? "bg-purple-50 text-purple-700 border border-purple-300"
                          : "bg-surface-container text-muted"
                      }`}>
                        {ask.status}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-[10px] text-muted truncate max-w-[120px]">
                      {ask.seller_email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bids Column */}
        <div className="border border-line bg-white p-5">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-mono text-label-caps uppercase text-ink font-semibold">
              Active Bids ({bids.length})
            </h2>
            <span className="font-mono text-xs text-muted">Buyer Orderbook</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b border-line bg-surface-container/40 font-mono text-[10px] uppercase text-muted">
                <tr>
                  <th className="p-2">Product &amp; Size</th>
                  <th className="p-2">Bid (INR)</th>
                  <th className="p-2">Buyer</th>
                  <th className="p-2">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bids.slice(0, 25).map((bid) => (
                  <tr key={bid.id}>
                    <td className="p-2">
                      <span className="font-medium text-ink block truncate max-w-[180px]">
                        {bid.product_title}
                      </span>
                      <span className="font-mono text-[10px] text-muted">{bid.variant_title}</span>
                    </td>
                    <td className="p-2 font-mono font-semibold text-blue-800">
                      ₹{Number(bid.bid_price).toLocaleString("en-IN")}
                    </td>
                    <td className="p-2 font-mono text-[10px] text-muted truncate max-w-[120px]">
                      {bid.buyer_email}
                    </td>
                    <td className="p-2 font-mono text-[10px] text-muted">
                      {new Date(bid.expires_at).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
