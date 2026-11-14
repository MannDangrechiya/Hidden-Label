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
    <div className="border-b border-ink/20 bg-ink text-surface py-2 px-4 overflow-hidden">
      <div className="mx-auto flex w-full max-w-page items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-3">
          {activity.length > 0 ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Recent Activity
              </span>
              <span className="hidden sm:inline text-surface/30">|</span>
              <MarketTickerRotator items={activity} />
            </>
          ) : (
            <span className="text-surface/70">The Hidden Label — multi-brand footwear and streetwear.</span>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-4 text-[11px] text-surface/70">
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
