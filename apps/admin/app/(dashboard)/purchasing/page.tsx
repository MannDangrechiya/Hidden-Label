import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import {
  fetchAdminSuppliers,
  fetchAdminPurchaseOrders,
  fetchAdminStockMovements,
} from "../../../lib/api/purchasing";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Supply Chain & Stock Ledger" };

export default async function PurchasingPage() {
  let suppliers;
  let purchaseOrders;
  let stockMovements;

  try {
    [suppliers, purchaseOrders, stockMovements] = await Promise.all([
      fetchAdminSuppliers(),
      fetchAdminPurchaseOrders(),
      fetchAdminStockMovements(),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load purchasing ledger.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-headline-lg">Supply Chain, POs &amp; Stock Ledger</h1>
        <p className="font-sans text-body-sm text-muted">
          Luxury wholesale procurement, purchase orders, goods receipt notes (GRN), and immutable stock mutation ledger.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-line bg-white p-5">
          <span className="font-mono text-xs uppercase text-muted block mb-1">Active Suppliers</span>
          <span className="font-display text-3xl font-bold text-ink">{suppliers.length}</span>
          <span className="block font-sans text-xs text-muted mt-1">Verified luxury mills &amp; distributors</span>
        </div>
        <div className="border border-line bg-white p-5">
          <span className="font-mono text-xs uppercase text-muted block mb-1">Inbound Purchase Orders</span>
          <span className="font-display text-3xl font-bold text-ink">{purchaseOrders.length}</span>
          <span className="block font-sans text-xs text-muted mt-1">
            {purchaseOrders.filter((p) => p.status === "ordered" || p.status === "partially_received").length} currently in transit
          </span>
        </div>
        <div className="border border-line bg-white p-5">
          <span className="font-mono text-xs uppercase text-muted block mb-1">Stock Movement Entries</span>
          <span className="font-display text-3xl font-bold text-ink">{stockMovements.length}</span>
          <span className="block font-sans text-xs text-muted mt-1">Immutable audit ledger events</span>
        </div>
      </div>

      {/* Section 1: Purchase Orders */}
      <div className="border border-line bg-white p-6">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Inbound Purchase Orders</h2>
            <p className="font-sans text-xs text-muted">Wholesale procurement lines and receipt status.</p>
          </div>
          <a
            href="/reports/export/gst"
            className="border border-line px-3 py-1.5 font-mono text-xs uppercase text-ink hover:border-ink transition-colors"
          >
            Export GSTR-1 Tax CSV
          </a>
        </div>

        {purchaseOrders.length === 0 ? (
          <div className="text-center py-8 font-sans text-xs text-muted">No purchase orders drafted.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b border-line bg-surface-container/30 font-mono text-[10px] uppercase text-muted">
                <tr>
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Total Value</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ordered Date</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="p-3 font-mono font-bold text-ink">{po.display_id}</td>
                    <td className="p-3 font-medium text-ink">{po.supplier_name}</td>
                    <td className="p-3 font-mono">₹{Number(po.total_cost_rupees).toLocaleString("en-IN")}</td>
                    <td className="p-3">
                      <span className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase font-semibold">
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted">{new Date(po.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="p-3 text-muted">{po.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Immutable Stock Movement Ledger */}
      <div className="border border-line bg-white p-6">
        <div className="border-b border-line pb-4 mb-4">
          <h2 className="font-display text-lg font-semibold text-ink">Stock Movement Audit Ledger</h2>
          <p className="font-sans text-xs text-muted">
            Continuous audit log of receipts, fulfillment allocations, returns, and inventory counts.
          </p>
        </div>

        {stockMovements.length === 0 ? (
          <div className="text-center py-8 font-sans text-xs text-muted">No stock movements recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="border-b border-line bg-surface-container/30 font-mono text-[10px] uppercase text-muted">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Inventory Item</th>
                  <th className="p-3">Movement Type</th>
                  <th className="p-3">Delta</th>
                  <th className="p-3">Balance After</th>
                  <th className="p-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stockMovements.map((sm) => (
                  <tr key={sm.id}>
                    <td className="p-3 font-mono text-muted">{new Date(sm.created_at).toLocaleString("en-IN")}</td>
                    <td className="p-3 font-mono text-ink">{sm.inventory_item_id}</td>
                    <td className="p-3">
                      <span className="font-mono text-[10px] uppercase font-semibold text-ink">
                        {sm.movement_type}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <span className={sm.delta > 0 ? "text-emerald-700" : "text-rose-700"}>
                        {sm.delta > 0 ? `+${sm.delta}` : sm.delta}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold text-ink">{sm.balance_after}</td>
                    <td className="p-3 text-muted">{sm.notes ?? sm.reference_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
