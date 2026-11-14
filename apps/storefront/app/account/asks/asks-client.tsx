"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { cancelMyAsk, type SellerAskRecord } from "@/lib/resale";

export function CustomerAsksClient({
  initialAsks,
  token,
}: {
  initialAsks: SellerAskRecord[];
  token: string;
}) {
  const [asks, setAsks] = useState(initialAsks);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel and delist this item?")) return;
    setCancellingId(id);
    try {
      const res = await cancelMyAsk(id, token);
      if (res.success) {
        setAsks((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "cancelled" } : a)),
        );
      } else {
        alert(res.error || "Failed to cancel listing");
      }
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {asks.length === 0 ? (
        <div className="border border-line bg-surface p-8 text-center">
          <p className="font-mono text-xs uppercase text-muted mb-2">No active seller consignments</p>
          <p className="font-sans text-xs text-on-surface-variant max-w-md mx-auto mb-4">
            Turn your kicks into cash. List in 60 seconds with 0 listing fees. Our authentication team verifies every pair before dispatch and guarantees your payout.
          </p>
          <Link
            href="/sell"
            className="inline-block border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase text-surface"
          >
            List a Pair for Sale →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full text-left font-sans text-xs">
            <thead className="border-b border-line bg-surface-container/50 font-mono text-[10px] uppercase text-muted">
              <tr>
                <th className="p-3">Product &amp; Size</th>
                <th className="p-3">Asking Price</th>
                <th className="p-3">Condition &amp; Box</th>
                <th className="p-3">Status</th>
                <th className="p-3">Listed On</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {asks.map((a) => {
                const priceNum = typeof a.ask_price === "number" ? a.ask_price : Number(a.ask_price) || 0;
                return (
                  <tr key={a.id} className="hover:bg-surface-container/20">
                    <td className="p-3">
                      <Link
                        href={`/products/${a.product?.handle ?? ""}`}
                        className="font-medium text-ink hover:underline block truncate max-w-[200px]"
                      >
                        {a.product?.title ?? "Product"}
                      </Link>
                      <span className="font-mono text-[10px] text-muted">Size: {a.variant?.size ?? "N/A"}</span>
                    </td>
                    <td className="p-3 font-mono font-bold text-ink">
                      {formatINR(moneyFromRupees(priceNum))}
                    </td>
                    <td className="p-3">
                      <span className="inline-block rounded-sm bg-surface-container px-2 py-0.5 font-mono text-[10px] uppercase text-ink mr-2">
                        {a.condition_grade}
                      </span>
                      <span className="font-mono text-[10px] text-muted capitalize">
                        {a.box_condition}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase ${
                          a.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 font-bold"
                            : a.status === "matched" || a.status === "sold"
                            ? "bg-blue-500/10 text-blue-600 font-bold"
                            : "bg-surface-container text-muted"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted">
                      {new Date(a.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-3 text-right">
                      {a.status === "active" && (
                        <button
                          type="button"
                          onClick={() => handleCancel(a.id)}
                          disabled={cancellingId === a.id}
                          className="font-mono text-[10px] uppercase text-rose-600 hover:underline disabled:opacity-50"
                        >
                          {cancellingId === a.id ? "Delisting..." : "Delist / Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
