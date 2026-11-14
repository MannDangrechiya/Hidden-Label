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
      <span className="hidden md:inline text-surface/60">({relativeTime(event.created_at)})</span>
    </div>
  );
}
