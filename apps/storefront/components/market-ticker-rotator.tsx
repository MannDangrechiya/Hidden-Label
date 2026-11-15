"use client";

import { useEffect, useState } from "react";
import type { ResaleActivityItem } from "@/lib/medusa";
import { formatINR, moneyFromRupees } from "@thl/shared";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diffMs / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Client-side rotation only — the activity data itself is fetched server-side from real
 * order lines (see market-ticker.tsx / lib/medusa.ts fetchRecentActivity). No fabricated rows. */
export function MarketTickerRotator({ items }: { items: ResaleActivityItem[] }) {
  const [index, setIndex] = useState(0);
  /**
   * "14m ago" is computed from `Date.now()`, so the server and the browser disagree by the time
   * hydration runs. That mismatch made React throw away and re-render the whole tree on every
   * page load — which is what looked like the site refreshing itself. The relative stamp is
   * therefore client-only: both the server render and the first client render leave it out.
   */
  const [showRelative, setShowRelative] = useState(false);

  useEffect(() => {
    setShowRelative(true);
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % items.length), 4000);
    return () => clearInterval(timer);
  }, [items.length]);

  const event = items[index % items.length];
  if (!event) return null;

  return (
    <div className="flex items-center gap-2 truncate">
      <span className="font-semibold text-surface truncate">{event.product_title}</span>
      {event.variant_title ? (
        <span className="border border-surface/30 px-1.5 py-0.2 text-[10px] uppercase text-surface/80">
          {event.variant_title}
        </span>
      ) : null}
      <span className="text-emerald-400 font-bold">
        {formatINR(moneyFromRupees(event.unit_price))}
      </span>
      {showRelative ? (
        <span className="hidden md:inline text-surface/60">({relativeTime(event.created_at)})</span>
      ) : null}
    </div>
  );
}
