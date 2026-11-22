/**
 * Resale marketplace math, pricing index metrics, and fit studio calculations.
 */

export interface PricePoint {
  price_rupees: number;
  recorded_at: Date | string;
}

export interface PriceMetrics {
  latest_price: number | null;
  change_pct_30d: number;
  high_52w: number | null;
  low_52w: number | null;
  points_count: number;
}

export function calculatePriceMetrics(points: PricePoint[]): PriceMetrics {
  if (!points || points.length === 0) {
    return {
      latest_price: null,
      change_pct_30d: 0,
      high_52w: null,
      low_52w: null,
      points_count: 0,
    };
  }

  const sorted = [...points].sort((a, b) => {
    return new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime();
  });

  const prices = sorted.map((p) => Number(p.price_rupees));
  const latest = prices[prices.length - 1] ?? null;
  const oldest = prices[0] ?? null;

  let changePct = 0;
  if (latest !== null && oldest !== null && oldest > 0) {
    changePct = Number((((latest - oldest) / oldest) * 100).toFixed(1));
  }

  return {
    latest_price: latest,
    change_pct_30d: changePct,
    high_52w: Math.max(...prices),
    low_52w: Math.min(...prices),
    points_count: points.length,
  };
}

export interface FitRuleInput {
  silhouette_name: string;
  recommended_size_delta: number;
  width_profile: string;
  guidance_text: string;
}

export interface RecommendSizeInput {
  footLengthCm?: number;
  baselineUkSize?: number;
  footWidth?: "narrow" | "regular" | "wide";
  rule?: FitRuleInput | null;
}

export interface RecommendSizeOutput {
  recommended_size: string;
  recommended_size_number: number;
  baseline_uk_size: number;
  total_delta: number;
  guidance: string;
}

export function cmToStandardUk(cm: number): number {
  if (cm <= 24.0) return 5.0;
  if (cm <= 24.5) return 5.5;
  if (cm <= 25.0) return 6.0;
  if (cm <= 25.5) return 6.5;
  if (cm <= 26.0) return 7.0;
  if (cm <= 26.5) return 7.5;
  if (cm <= 27.0) return 8.0;
  if (cm <= 27.5) return 8.5;
  if (cm <= 28.0) return 9.0;
  if (cm <= 28.5) return 9.5;
  if (cm <= 29.0) return 10.0;
  if (cm <= 29.5) return 10.5;
  if (cm <= 30.0) return 11.0;
  return 11.5;
}

export function recommendShoeSize(input: RecommendSizeInput): RecommendSizeOutput {
  const { footLengthCm, baselineUkSize, footWidth = "regular", rule } = input;

  let baseline = 8.0;
  if (typeof footLengthCm === "number" && footLengthCm > 15) {
    baseline = cmToStandardUk(footLengthCm);
  } else if (typeof baselineUkSize === "number") {
    baseline = baselineUkSize;
  }

  let delta = 0;
  let guidance = "Standard sneaker fit applies.";

  if (rule) {
    delta += Number(rule.recommended_size_delta);
    guidance = rule.guidance_text;

    if (footWidth === "wide" && rule.width_profile === "narrow") {
      delta += 0.5;
      guidance += " Added half size for wide foot comfort.";
    } else if (footWidth === "narrow" && rule.width_profile === "wide") {
      delta -= 0.5;
    }
  } else if (footWidth === "wide") {
    delta += 0.5;
    guidance = "For wide feet, half a size up is recommended.";
  }

  const rec = Math.round((baseline + delta) * 2) / 2;
  return {
    recommended_size: `UK ${rec.toFixed(1)}`,
    recommended_size_number: rec,
    baseline_uk_size: baseline,
    total_delta: delta,
    guidance,
  };
}

export function computeOrderbookSpread(
  lowestAsk: number | null,
  highestBid: number | null,
): { spread_rupees: number | null; spread_pct: number | null } {
  if (lowestAsk === null || highestBid === null || lowestAsk <= 0) {
    return { spread_rupees: null, spread_pct: null };
  }
  const spreadRupees = lowestAsk - highestBid;
  const spreadPct = Number(((spreadRupees / lowestAsk) * 100).toFixed(1));
  return { spread_rupees: spreadRupees, spread_pct: spreadPct };
}

export function calculateConsignorPayout(
  askPriceRupees: number,
  platformFeeRate?: number | null,
): {
  configured: boolean;
  platform_fee_rupees: number | null;
  estimated_payout_rupees: number | null;
} {
  const envRate = process.env.CONSIGNMENT_COMMISSION_RATE
    ? Number(process.env.CONSIGNMENT_COMMISSION_RATE)
    : null;
  const rate =
    typeof platformFeeRate === "number" && Number.isFinite(platformFeeRate)
      ? platformFeeRate
      : envRate;

  if (rate === null || !Number.isFinite(rate)) {
    return {
      configured: false,
      platform_fee_rupees: null,
      estimated_payout_rupees: null,
    };
  }

  const ask = Math.max(0, Math.round(askPriceRupees));
  const fee = Math.round(ask * rate);
  const payout = Math.max(0, ask - fee);
  return {
    configured: true,
    platform_fee_rupees: fee,
    estimated_payout_rupees: payout,
  };
}
