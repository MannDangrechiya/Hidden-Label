"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { AddToBag, type SizeOption } from "@/components/add-to-bag";
import { BespokeDrawer } from "@/components/bespoke-drawer";
import { BidModal } from "@/components/bid-modal";

export interface ProductBuyPanelProps {
  sizes: SizeOption[];
  productHandle: string;
  productTitle: string;
  /** True for apparel PDPs (an XS–XXL run or declared apparel category). */
  bespokeEnabled: boolean;
  signedIn: boolean;
}

interface BidRequest {
  variantId: string;
  sizeLabel: string;
  suggestedBid: number;
  lowestAsk: number | null;
}

function rupees(value: number | null | undefined): string | null {
  if (typeof value !== "number" || value < 0) return null;
  try {
    return formatINR(moneyFromRupees(value));
  } catch {
    return null;
  }
}

/**
 * Owns the three interactive pieces of the product buy block:
 *
 * 1. the size/buy CTAs (`AddToBag`),
 * 2. the buyer bid dialog wired to `POST /store/resale/bids`,
 * 3. the made-to-measure drawer for apparel, plus the mobile sticky buy bar that appears once
 *    the primary CTA has scrolled out of view (IntersectionObserver on a sentinel below it).
 */
export function ProductBuyPanel({
  sizes,
  productHandle,
  productTitle,
  bespokeEnabled,
  signedIn,
}: ProductBuyPanelProps) {
  const [selected, setSelected] = useState<SizeOption | null>(null);
  const [bid, setBid] = useState<BidRequest | null>(null);
  const [bespokeOpen, setBespokeOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [stickyEnabled, setStickyEnabled] = useState(false);

  const buyActionRef = useRef<(() => void) | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleSelectionChange = useCallback((size: SizeOption | null) => {
    setSelected(size);
  }, []);

  const handleOpenBid = useCallback(
    (variantId: string, sizeLabel: string, suggestedBid: number) => {
      const match = sizes.find((size) => size.variantId === variantId) ?? null;
      setBid({ variantId, sizeLabel, suggestedBid, lowestAsk: match?.lowestAsk ?? null });
    },
    [sizes],
  );

  // Mobile sticky bar: only meaningful below the 768px breakpoint, and only once the real CTA
  // has left the viewport. The observer is torn down on unmount and re-created when the sentinel
  // changes.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;

    const mql = window.matchMedia("(max-width: 767px)");
    setStickyEnabled(mql.matches);

    const onViewportChange = (event: MediaQueryListEvent) => {
      setStickyEnabled(event.matches);
      if (!event.matches) setStickyVisible(false);
    };
    mql.addEventListener("change", onViewportChange);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setStickyVisible(entry ? !entry.isIntersecting : false);
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0 },
    );
    observer.observe(node);

    return () => {
      mql.removeEventListener("change", onViewportChange);
      observer.disconnect();
    };
  }, []);

  const showSticky = stickyEnabled && stickyVisible && sizes.length > 0;
  const stickyPrice = rupees(selected?.lowestAsk);
  const canBuy = Boolean(selected?.available);

  // MOBILE-06: the pinned bar covers the bottom ~92px of the document, so while it is shown the
  // page gets matching bottom clearance (footer included) — otherwise the last footer rows are
  // permanently unreachable behind the bar. The flag is mobile-only, like the bar itself.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("thl-quick-buy-active", showSticky);
    return () => document.body.classList.remove("thl-quick-buy-active");
  }, [showSticky]);

  return (
    <div className="relative">
      {bespokeEnabled ? (
        <div className="mb-sp-3 border border-ink">
          <div className="flex flex-col gap-2 p-sp-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-label-caps uppercase text-ink">Custom made-to-measure</span>
              <span className="font-mono text-label-caps uppercase text-muted">Cut to your inches</span>
            </div>
            <p className="font-sans text-body-sm text-on-surface-variant">
              Send the atelier your chest, waist, shoulder, arm and inseam. A master tailor reviews
              the sheet before the fabric is cut at our Sindhu Bhavan Road boutique.
            </p>
            <button
              type="button"
              onClick={() => setBespokeOpen(true)}
              className="mt-1 inline-flex min-h-12 w-fit items-center border border-ink bg-surface px-5 py-2 font-mono text-label-caps uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-white"
            >
              Open measurement drawer →
            </button>
          </div>
        </div>
      ) : null}

      <AddToBag
        sizes={sizes}
        productHandle={productHandle}
        onOpenBidModal={handleOpenBid}
        onSelectionChange={handleSelectionChange}
        buyActionRef={buyActionRef}
      />

      {/* Sentinel: when this leaves the viewport, the mobile sticky bar slides in. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {showSticky ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden"
          role="region"
          aria-label="Quick buy"
        >
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-label-caps uppercase text-muted">
                {selected ? selected.label : "Select a size"}
              </span>
              <span className="font-mono text-currency-md tabular text-ink">
                {stickyPrice ?? "Price at checkout"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => buyActionRef.current?.()}
              disabled={!canBuy}
              className="ml-auto flex min-h-12 flex-1 items-center justify-center border border-ink bg-ink px-4 font-mono text-label-caps uppercase tracking-[0.12em] text-white transition-colors enabled:hover:bg-accent enabled:hover:text-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
            >
              {canBuy ? "Buy now" : "Sold out"}
            </button>
          </div>
          {!signedIn ? (
            <Link
              href="/login"
              className="mt-1 block text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted no-underline"
            >
              Sign in to save this piece
            </Link>
          ) : null}
        </div>
      ) : null}

      <BidModal
        open={bid !== null}
        onClose={() => setBid(null)}
        variantId={bid?.variantId ?? null}
        sizeLabel={bid?.sizeLabel ?? ""}
        suggestedBid={bid?.suggestedBid ?? 10000}
        lowestAsk={bid?.lowestAsk ?? null}
        signedIn={signedIn}
      />

      <BespokeDrawer
        open={bespokeOpen}
        onClose={() => setBespokeOpen(false)}
        variantId={selected?.variantId ?? null}
        sizeLabel={selected?.label ?? "Not selected"}
        productHandle={productHandle}
        productTitle={productTitle}
      />
    </div>
  );
}
