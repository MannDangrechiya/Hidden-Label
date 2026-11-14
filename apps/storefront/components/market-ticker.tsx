"use client";

import { useEffect, useState } from "react";

const LIVE_EVENTS = [
  { item: "Air Jordan 1 Retro High 'Chicago'", size: "UK 8.0", price: "₹38,990", city: "Mumbai", time: "3m ago", type: "sold" },
  { item: "Samba OG 'Cloud White'", size: "UK 9.0", price: "₹12,990", city: "Bengaluru", time: "8m ago", type: "bid_matched" },
  { item: "Dunk Low 'Panda'", size: "UK 8.0", price: "₹11,995", city: "Delhi NCR", time: "14m ago", type: "sold" },
  { item: "New Balance 990v6 'Grey'", size: "UK 10.0", price: "₹21,999", city: "Hyderabad", time: "22m ago", type: "sold" },
  { item: "Salomon XT-6 'Vanilla Ice'", size: "UK 8.5", price: "₹18,500", city: "Pune", time: "31m ago", type: "bid_matched" },
  { item: "Air Jordan 4 Retro 'Bred Reimagined'", size: "UK 9.0", price: "₹32,000", city: "Chennai", time: "45m ago", type: "sold" },
];

export function MarketTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % LIVE_EVENTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const fallback = LIVE_EVENTS[0] as (typeof LIVE_EVENTS)[number];
  const event = LIVE_EVENTS[currentIndex] ?? fallback;

  return (
    <div className="border-b border-ink/20 bg-ink text-surface py-2 px-4 overflow-hidden">
      <div className="mx-auto flex w-full max-w-page items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Marketplace Trades
          </span>
          <span className="hidden sm:inline text-surface/30">|</span>
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-surface truncate">{event.item}</span>
            <span className="border border-surface/30 px-1.5 py-0.2 text-[10px] uppercase text-surface/80">
              {event.size}
            </span>
            <span className="text-emerald-400 font-bold">{event.price}</span>
            <span className="hidden md:inline text-surface/60">
              ({event.type === "sold" ? "Instant Buy" : "Bid Matched"} in {event.city} · {event.time})
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 text-[11px] text-surface/70">
          <span className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> 100% Authentic Guaranteed
          </span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> 360° Physical Lab Inspection
          </span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> Express Dispatch in India
          </span>
        </div>
      </div>
    </div>
  );
}
