"use client";

import { useState } from "react";
import type { VariantResaleData } from "@/lib/resale";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { placeResaleBid } from "@/lib/resale";
import { biddingEnabled as biddingEnabledFlag } from "@/lib/feature-flags";

function formatRupees(amount: number): string {
  try {
    return formatINR(moneyFromRupees(amount)).replace(/^₹/, "");
  } catch {
    return String(amount);
  }
}

interface PriceIndexCardProps {
  variants: VariantResaleData[];
  selectedVariantId?: string;
  onSelectVariant?: (variantId: string) => void;
  customerToken?: string | null;
}

export function PriceIndexCard({
  variants,
  selectedVariantId,
  onSelectVariant,
  customerToken,
}: PriceIndexCardProps) {
  const currentVariant =
    variants.find((v) => v.variant_id === selectedVariantId) ?? variants[0];

  const [activeTab, setActiveTab] = useState<"chart" | "bid">("chart");
  const [bidAmount, setBidAmount] = useState<number>(
    currentVariant?.highest_bid ? currentVariant.highest_bid + 500 : 15000,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidMessage, setBidMessage] = useState<{ text: string; error?: boolean } | null>(null);

  if (!currentVariant) return null;

  const history = currentVariant.price_history ?? [];
  const prices = history.map((p) => p.price_rupees);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 10000;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 20000;
  const range = maxPrice - minPrice || 1;

  // Build SVG polyline points (normalized to 100x40 viewport)
  const svgPoints = history
    .map((p, idx) => {
      const x = (idx / Math.max(history.length - 1, 1)) * 100;
      const y = 35 - ((p.price_rupees - minPrice) / range) * 30;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToken) {
      setBidMessage({ text: "Please sign in to place a verified bid.", error: true });
      return;
    }
    setIsSubmitting(true);
    setBidMessage(null);
    const res = await placeResaleBid(currentVariant.variant_id, bidAmount, customerToken);
    setIsSubmitting(false);
    if (res.success) {
      setBidMessage({ text: `Bid of ₹${formatRupees(bidAmount)} placed successfully!` });
    } else {
      setBidMessage({ text: res.error || "Failed to place bid.", error: true });
    }
  };

  const isUp = currentVariant.change_pct_30d >= 0;
  // Requires the resale programme too — the parent render already gates on resale, but this
  // helper keeps the two flags coupled everywhere bidding is read.
  const biddingEnabled = biddingEnabledFlag();
  const effectiveTab = biddingEnabled ? activeTab : "chart";

  return (
    <div className="border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-mono text-label-caps uppercase tracking-wider text-ink">
            The Price Index
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("chart")}
            className={`font-mono text-xs uppercase px-2.5 py-1 border ${
              effectiveTab === "chart"
                ? "border-ink bg-ink text-surface"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            Market Trend
          </button>
          {biddingEnabled ? (
            <button
              type="button"
              onClick={() => setActiveTab("bid")}
              className={`font-mono text-xs uppercase px-2.5 py-1 border ${
                effectiveTab === "bid"
                  ? "border-ink bg-ink text-surface"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              Place Bid
            </button>
          ) : null}
        </div>
      </div>

      {/* Variant Size Switcher */}
      <div className="my-3 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs uppercase text-muted mr-1">Size:</span>
        {variants.map((v) => (
          <button
            key={v.variant_id}
            type="button"
            onClick={() => {
              onSelectVariant?.(v.variant_id);
              if (v.highest_bid) setBidAmount(v.highest_bid + 500);
            }}
            className={`px-2 py-0.5 font-mono text-xs border transition-colors ${
              v.variant_id === currentVariant.variant_id
                ? "border-ink bg-surface-container font-semibold text-ink"
                : "border-line text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {v.size}
          </button>
        ))}
      </div>

      {effectiveTab === "chart" ? (
        <div className="space-y-4">
          {/* Key Secondary Metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="border border-line p-2.5">
              <span className="block font-mono text-[10px] uppercase text-muted">Lowest Ask</span>
              <span className="font-sans text-sm font-semibold text-ink">
                {currentVariant.lowest_ask ? `₹${formatRupees(currentVariant.lowest_ask)}` : "—"}
              </span>
            </div>
            <div className="border border-line p-2.5">
              <span className="block font-mono text-[10px] uppercase text-muted">Highest Bid</span>
              <span className="font-sans text-sm font-semibold text-ink">
                {currentVariant.highest_bid ? `₹${formatRupees(currentVariant.highest_bid)}` : "—"}
              </span>
            </div>
            <div className="border border-line p-2.5">
              <span className="block font-mono text-[10px] uppercase text-muted">30D Trend</span>
              <span
                className={`font-sans text-sm font-semibold ${
                  isUp ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isUp ? `+${currentVariant.change_pct_30d}%` : `${currentVariant.change_pct_30d}%`}
              </span>
            </div>
            <div className="border border-line p-2.5">
              <span className="block font-mono text-[10px] uppercase text-muted">52W Range</span>
              <span className="font-sans text-xs text-ink truncate block">
                {currentVariant.low_52w && currentVariant.high_52w
                  ? `₹${formatRupees(currentVariant.low_52w)} - ₹${formatRupees(currentVariant.high_52w)}`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Sparkline Chart */}
          {history.length > 1 ? (
            <div className="border border-line bg-surface-container/50 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-mono text-muted">
                <span>90-Day Trade Valuation Curve ({currentVariant.size})</span>
                <span>Latest: ₹{formatRupees(currentVariant.last_sale_price ?? 0)}</span>
              </div>
              <div className="h-20 w-full">
                <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                  {/* Subtle grid line */}
                  <line x1="0" y1="20" x2="100" y2="20" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="2 2" />
                  <polyline
                    fill="none"
                    stroke={isUp ? "#059669" : "#e11d48"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={svgPoints}
                  />
                </svg>
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                <span>90d ago (₹{formatRupees(history[0]?.price_rupees ?? 0)})</span>
                <span>Today (₹{formatRupees(history[history.length - 1]?.price_rupees ?? 0)})</span>
              </div>
            </div>
          ) : (
            <p className="font-mono text-xs text-muted">Valuation data updating...</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-[11px] text-muted">
              {currentVariant.active_asks_count} active asks · {currentVariant.active_bids_count} active bids
            </span>
            {biddingEnabled ? (
              <button
                type="button"
                onClick={() => setActiveTab("bid")}
                className="font-mono text-xs underline text-ink hover:text-muted"
              >
                Want to bid? Click here
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={handlePlaceBid} className="space-y-4 pt-2">
          <div>
            <label className="block font-mono text-xs uppercase text-muted mb-1">
              Your Bid (INR) for {currentVariant.size}
            </label>
            <div className="flex items-center">
              <span className="border border-r-0 border-line bg-surface-container px-3 py-2 font-mono text-sm text-muted">
                ₹
              </span>
              <input
                type="number"
                min="1000"
                step="500"
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="w-full border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-ink focus:outline-none"
              />
            </div>
            <span className="mt-1 block font-mono text-[10px] text-muted">
              Current highest bid: {currentVariant.highest_bid ? `₹${formatRupees(currentVariant.highest_bid)}` : "None"} · Lowest ask: {currentVariant.lowest_ask ? `₹${formatRupees(currentVariant.lowest_ask)}` : "None"}
            </span>
          </div>

          {bidMessage && (
            <div
              className={`p-2 font-mono text-xs border ${
                bidMessage.error ? "border-rose-400 bg-rose-50 text-rose-700" : "border-emerald-400 bg-emerald-50 text-emerald-700"
              }`}
            >
              {bidMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full border border-ink bg-ink py-2.5 font-mono text-xs uppercase tracking-wider text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Placing Bid..." : `Submit Bid of ₹${formatRupees(bidAmount)}`}
          </button>
        </form>
      )}
    </div>
  );
}
