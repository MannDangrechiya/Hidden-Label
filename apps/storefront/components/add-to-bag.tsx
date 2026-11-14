"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";
import { formatINR, moneyFromRupees } from "@thl/shared";

export interface SizeOption {
  variantId: string;
  label: string;
  available: boolean;
  quantity: number | null;
  lowestAsk?: number | null;
  highestBid?: number | null;
  isLowestPriceInRun?: boolean;
}

interface AddToBagProps {
  sizes: SizeOption[];
  productHandle?: string;
  onOpenBidModal?: (variantId: string, sizeLabel: string, suggestedBid: number) => void;
}

function formatPrice(amount: number): string {
  try {
    return formatINR(moneyFromRupees(amount));
  } catch {
    return `₹${amount.toLocaleString("en-IN")}`;
  }
}

export function AddToBag({ sizes, productHandle, onOpenBidModal }: AddToBagProps) {
  const router = useRouter();

  // Find lowest price available variant as default
  const defaultVariant =
    sizes.find((s) => s.isLowestPriceInRun && s.available) ??
    sizes.find((s) => s.available) ??
    sizes[0];

  const [selected, setSelected] = useState<string | null>(defaultVariant?.variantId ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const chosen = sizes.find((size) => size.variantId === selected) ?? null;
  const currentPrice = chosen?.lowestAsk ?? null;
  const currentBid = chosen?.highestBid ?? null;

  function submit() {
    if (!selected) {
      setMessage("Please select your size first.");
      return;
    }
    startTransition(async () => {
      const result = await addToCart(selected, 1);
      if (result.ok) {
        setAdded(true);
        setMessage("Added to bag successfully.");
        router.refresh();
        router.push("/cart");
      } else {
        setMessage(result.message ?? "Could not add to bag.");
      }
    });
  }

  function handleBidClick() {
    if (!chosen) return;
    const suggested = currentBid ? currentBid + 500 : (currentPrice ? Math.round(currentPrice * 0.9) : 10000);
    onOpenBidModal?.(chosen.variantId, chosen.label, suggested);
  }

  if (sizes.length === 0) {
    return (
      <p className="border border-line px-4 py-3 font-sans text-body-sm text-on-surface-variant">
        This product has no purchasable variants yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* CultureCircle Size-Wise Pricing Selector */}
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <legend className="font-mono text-label-caps uppercase text-ink font-semibold">
            Select Size &amp; Instant Market Value:
          </legend>
          {/* D2: dropped the blanket "verified authentic" claim — the real per-unit
              authentication report (when one exists) renders separately below via
              InspectionViewer, gated on an actual approved inspection record. */}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sizes.map((size) => {
            const isSelected = size.variantId === selected;
            const price = size.lowestAsk;

            return (
              <button
                key={size.variantId}
                type="button"
                onClick={() => {
                  setSelected(size.variantId);
                  setAdded(false);
                  setMessage(null);
                }}
                disabled={!size.available}
                aria-pressed={isSelected}
                className={[
                  "relative flex flex-col items-center justify-center border p-3 font-mono transition-all",
                  size.available
                    ? isSelected
                      ? "border-ink bg-ink text-surface shadow-md"
                      : "border-line bg-surface text-ink hover:border-ink hover:bg-surface-container/40"
                    : "cursor-not-allowed border-line/50 bg-line/30 text-muted opacity-50",
                ].join(" ")}
              >
                {size.isLowestPriceInRun && size.available && (
                  <span
                    className={`absolute -top-2 right-2 px-1.5 py-0.2 font-mono text-[9px] uppercase font-bold tracking-wider rounded-xs ${
                      isSelected ? "bg-emerald-400 text-ink" : "bg-emerald-600 text-surface"
                    }`}
                  >
                    Lowest
                  </span>
                )}
                <span className="font-bold text-sm tracking-wide">{size.label}</span>
                <span
                  className={`text-xs mt-0.5 ${
                    isSelected ? "text-emerald-300 font-semibold" : "text-muted"
                  }`}
                >
                  {price ? formatPrice(price) : "Make Bid"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* CultureCircle Dual Action CTA Bar */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {/* Buy Now Primary CTA */}
        <button
          type="button"
          onClick={submit}
          disabled={pending || !chosen?.available}
          className="flex-1 min-h-14 border border-ink bg-ink px-6 py-3.5 font-mono text-xs uppercase tracking-[0.14em] text-surface transition-all hover:bg-ink/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 shadow-lg"
        >
          <span className="font-bold">
            {pending
              ? "Securing Pair..."
              : currentPrice
              ? `Buy Now — ${formatPrice(currentPrice)}`
              : "Add to Bag"}
          </span>
          <span className="text-[10px] text-surface/70 tracking-normal normal-case font-sans">
            Instant Dispatch
          </span>
        </button>

        {/* Place Bid Secondary CTA */}
        <button
          type="button"
          onClick={handleBidClick}
          className="min-h-14 sm:w-48 border border-ink bg-surface px-5 py-3.5 font-mono text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:bg-surface-container active:scale-[0.99] flex flex-col items-center justify-center gap-0.5"
        >
          <span className="font-semibold">Place Bid</span>
          <span className="text-[10px] text-muted tracking-normal normal-case font-sans">
            {currentBid ? `High: ${formatPrice(currentBid)}` : "Make an offer"}
          </span>
        </button>
      </div>

      {/* Sell / Consign This Pair CTA */}
      <div className="flex items-center justify-between text-xs font-mono pt-0.5 px-0.5">
        <span className="text-muted">Got a pair in this silhouette?</span>
        <a
          href={`/sell?product=${encodeURIComponent(productHandle ?? "")}&size=${encodeURIComponent(chosen?.label ?? "")}`}
          className="font-bold text-ink hover:underline uppercase inline-flex items-center gap-1"
        >
          {/* D2: never fabricate a price when the real current price is missing. */}
          {currentPrice ? `Sell from ${formatPrice(currentPrice)} →` : "List this pair →"}
        </a>
      </div>

      {message && (
        <p
          role="status"
          className={`font-mono text-xs p-2 border ${
            added
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-rose-400 bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </p>
      )}

      {/* D2: removed — this box compared against named competitors (StockX/FlightClub) using a
          fabricated price (currentPrice * 1.38, not a real fetched quote) labelled as their
          actual pricing. Re-add only if a real, sourced comparison price is available. */}

      {/* D2: removed "100% Authentic or 200% Money Back" — an absolute, specific-numeric
          financial guarantee with no enforced inspect-before-ship workflow or refund mechanism
          behind it. Replaced with an honest description of the real, optional process; a unit
          with a real inspection record shows its actual report via InspectionViewer above. */}
      <div className="border border-line bg-surface-container/30 p-3 flex items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink text-surface font-mono text-xs">
          🛡️
        </div>
        <div className="text-xs">
          <span className="font-mono uppercase font-bold text-ink block">Return policy</span>
          <p className="font-sans text-[11px] text-muted">
            If something&rsquo;s wrong with your order, contact support within 7 days of delivery
            — see the authentication report above (when available) for this unit&rsquo;s real
            inspection status.
          </p>
        </div>
      </div>
    </div>
  );
}
