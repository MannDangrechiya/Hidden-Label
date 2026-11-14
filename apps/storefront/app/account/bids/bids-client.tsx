"use client";

import { useState } from "react";
import Link from "next/link";
import { formatINR, moneyFromRupees } from "@thl/shared";

interface CustomerBid {
  id: string;
  variant_id: string;
  bid_price: number;
  status: string;
  expires_at: string;
  created_at: string;
  variant: {
    size: string;
    sku: string | null;
  };
  product: {
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
  };
}

export function CustomerBidsClient({
  initialBids,
  token,
}: {
  initialBids: CustomerBid[];
  token: string;
}) {
  const [bids, setBids] = useState(initialBids);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const res = await fetch(`http://localhost:9000/store/resale/bids/${id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
          "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "",
        },
      });
      if (res.ok) {
        setBids((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)),
        );
      }
    } catch {
      // Ignore
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {bids.length === 0 ? (
        <div className="border border-line bg-surface p-8 text-center">
          <p className="font-mono text-xs uppercase text-muted mb-2">No active marketplace bids</p>
          <p className="font-sans text-xs text-on-surface-variant max-w-md mx-auto mb-4">
            You haven&rsquo;t placed any offers yet. On any product detail page, select your size and click &ldquo;Place Bid&rdquo; to make an offer.
          </p>
          <Link
            href="/collections/all"
            className="inline-block border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase text-surface"
          >
            Browse The Vault →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full text-left font-sans text-xs">
            <thead className="border-b border-line bg-surface-container/50 font-mono text-[10px] uppercase text-muted">
              <tr>
                <th className="p-3">Product &amp; Size</th>
                <th className="p-3">Your Bid (INR)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Placed On</th>
                <th className="p-3">Expires</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bids.map((b) => (
                <tr key={b.id} className="hover:bg-surface-container/20">
                  <td className="p-3">
                    <Link
                      href={`/products/${b.product.handle}`}
                      className="font-medium text-ink hover:underline block truncate max-w-[200px]"
                    >
                      {b.product.title}
                    </Link>
                    <span className="font-mono text-[10px] text-muted">Size: {b.variant.size}</span>
                  </td>
                  <td className="p-3 font-mono font-bold text-ink">
                    {formatINR(moneyFromRupees(b.bid_price))}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase font-semibold ${
                        b.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : b.status === "matched"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-surface-container text-muted"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-[10px] text-muted">
                    {new Date(b.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-muted">
                    {new Date(b.expires_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 text-right">
                    {b.status === "active" && (
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancel(b.id)}
                        className="font-mono text-[10px] uppercase underline text-rose-700 hover:text-rose-900 disabled:opacity-50"
                      >
                        Cancel Bid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
