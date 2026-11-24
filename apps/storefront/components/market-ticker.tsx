import { fetchRecentActivity } from "@/lib/medusa";
import { MarketTickerRotator } from "@/components/market-ticker-rotator";

/**
 * D2 fix (2026-11-14): this used to hardcode six invented trades across named Indian cities and
 * label them "Live Marketplace Trades" with a pulsing "live" dot — none of it was real. It now
 * fetches the real last few order lines placed on the store. With no real activity yet, it
 * renders an honest static strip instead of fabricating rows. The absolute "100% Authentic
 * Guaranteed" claim is also removed — see docs/BUILD_LOG.md for the full list of fixes.
 */
export async function MarketTicker() {
  const activity = await fetchRecentActivity().catch(() => []);

  return (
    <div className="border-b border-ink/20 bg-ink px-4 py-2 text-surface overflow-hidden">
      {/* MOBILE-04: `min-w-0` on both flex levels is what lets the rotator's `truncate` actually
          truncate — without it a long product title kept its intrinsic width (416px inside a
          305px viewport) and was hard-clipped mid-word instead of eliding. */}
      <div className="mx-auto flex w-full min-w-0 max-w-page items-center justify-between gap-3 text-xs font-mono">
        <div className="flex min-w-0 items-center gap-3">
          {activity.length > 0 ? (
            <>
              <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Recent Activity
              </span>
              <span className="hidden text-surface/30 sm:inline">|</span>
              <MarketTickerRotator items={activity} />
            </>
          ) : (
            <span className="truncate text-surface/70">
              The Hidden Label — multi-brand footwear and streetwear.
            </span>
          )}
        </div>

        <div className="hidden shrink-0 lg:flex items-center gap-4 text-[11px] text-surface/70">
          <span className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> Secure checkout
          </span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> Express dispatch in India
          </span>
        </div>
      </div>
    </div>
  );
}
