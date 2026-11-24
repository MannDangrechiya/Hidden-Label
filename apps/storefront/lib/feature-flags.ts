/**
 * Feature-flag helpers — the single source of truth the storefront reads.
 *
 * Rules (Task: feature gating & customer trust):
 *  - A deferred feature is visible ONLY when its own flag AND the flag of the programme it
 *    belongs to are both explicitly "true". Bidding is a resale capability: the orderbook,
 *    the bid modal and the bids API all live behind the resale gate, so showing "Place Bid"
 *    while resale is off used to leak a CTA that could never succeed.
 *  - Helpers are used by both server components and client components — Next inlines
 *    NEXT_PUBLIC_* values at build time, so the resolved values cannot be flipped from the
 *    browser to reveal a disabled feature.
 *  - Visibility is presentation only; the backend's own middlewares (apps/backend/src/api/
 *    middlewares.ts) enforce the same flags at every API boundary.
 */

/** Resale / consignment programme: orderbook, asks, inspections, "Sell". */
export function resaleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_RESALE === "true";
}

/** Bidding requires the resale programme AND its own flag to be approved. */
export function biddingEnabled(): boolean {
  return resaleEnabled() && process.env.NEXT_PUBLIC_FEATURE_BIDDING === "true";
}

/** AI layer: Style Concierge (AI-05) and Search by Sight (AI-01). */
export function aiLayerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_AI_LAYER === "true";
}

/** Fit Studio (sizing profiles and fit-based recommendations). */
export function fitStudioEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO === "true";
}
