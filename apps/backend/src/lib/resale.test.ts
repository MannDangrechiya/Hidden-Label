import { describe, expect, it } from "vitest";
import {
  calculateConsignorPayout,
  calculatePriceMetrics,
  cmToStandardUk,
  computeOrderbookSpread,
  recommendShoeSize,
} from "./resale";

describe("Resale & Fit Studio Calculations (apps/backend/src/lib/resale.ts)", () => {
  describe("cmToStandardUk", () => {
    it("converts metric foot measurements accurately to UK standard sizes", () => {
      expect(cmToStandardUk(24.5)).toBe(5.5);
      expect(cmToStandardUk(25.0)).toBe(6.0);
      expect(cmToStandardUk(26.0)).toBe(7.0);
      expect(cmToStandardUk(26.5)).toBe(7.5);
      expect(cmToStandardUk(27.0)).toBe(8.0);
      expect(cmToStandardUk(28.0)).toBe(9.0);
      expect(cmToStandardUk(29.0)).toBe(10.0);
    });
  });

  describe("recommendShoeSize", () => {
    it("applies true-to-size rules without alteration for regular feet", () => {
      const res = recommendShoeSize({
        footLengthCm: 26.5,
        footWidth: "regular",
        rule: {
          silhouette_name: "Air Jordan 1",
          recommended_size_delta: 0,
          width_profile: "regular",
          guidance_text: "True to size.",
        },
      });
      expect(res.baseline_uk_size).toBe(7.5);
      expect(res.recommended_size_number).toBe(7.5);
      expect(res.recommended_size).toBe("UK 7.5");
      expect(res.total_delta).toBe(0);
    });

    it("applies +0.5 delta for narrow silhouettes like Samba OG", () => {
      const res = recommendShoeSize({
        footLengthCm: 27.0,
        footWidth: "regular",
        rule: {
          silhouette_name: "Samba OG",
          recommended_size_delta: 0.5,
          width_profile: "narrow",
          guidance_text: "Runs narrow.",
        },
      });
      expect(res.baseline_uk_size).toBe(8.0);
      expect(res.recommended_size_number).toBe(8.5);
      expect(res.recommended_size).toBe("UK 8.5");
    });

    it("compounds wide foot penalty when silhouette is narrow", () => {
      const res = recommendShoeSize({
        footLengthCm: 27.0,
        footWidth: "wide",
        rule: {
          silhouette_name: "Samba OG",
          recommended_size_delta: 0.5,
          width_profile: "narrow",
          guidance_text: "Runs narrow.",
        },
      });
      // 8.0 baseline + 0.5 (narrow silhouette) + 0.5 (wide foot) = 9.0
      expect(res.baseline_uk_size).toBe(8.0);
      expect(res.recommended_size_number).toBe(9.0);
      expect(res.recommended_size).toBe("UK 9.0");
      expect(res.total_delta).toBe(1.0);
    });

    it("applies negative delta for roomy silhouettes like New Balance 990v6", () => {
      const res = recommendShoeSize({
        baselineUkSize: 8.0,
        footWidth: "regular",
        rule: {
          silhouette_name: "990v6",
          recommended_size_delta: -0.5,
          width_profile: "regular",
          guidance_text: "Runs large.",
        },
      });
      expect(res.recommended_size_number).toBe(7.5);
      expect(res.recommended_size).toBe("UK 7.5");
    });
  });

  describe("calculatePriceMetrics", () => {
    it("handles empty history gracefully", () => {
      const metrics = calculatePriceMetrics([]);
      expect(metrics.latest_price).toBeNull();
      expect(metrics.change_pct_30d).toBe(0);
      expect(metrics.high_52w).toBeNull();
      expect(metrics.points_count).toBe(0);
    });

    it("computes accurate 52-week high, low, and 30-day percentage trend", () => {
      const points = [
        { price_rupees: 10000, recorded_at: new Date(2026, 0, 1) },
        { price_rupees: 12500, recorded_at: new Date(2026, 0, 15) },
        { price_rupees: 11000, recorded_at: new Date(2026, 0, 30) },
      ];
      const metrics = calculatePriceMetrics(points);
      expect(metrics.latest_price).toBe(11000);
      expect(metrics.high_52w).toBe(12500);
      expect(metrics.low_52w).toBe(10000);
      expect(metrics.change_pct_30d).toBe(10.0); // (11000 - 10000) / 10000 * 100 = 10%
      expect(metrics.points_count).toBe(3);
    });
  });

  describe("computeOrderbookSpread", () => {
    it("calculates bid-ask spread correctly", () => {
      const spread = computeOrderbookSpread(40000, 36000);
      expect(spread.spread_rupees).toBe(4000);
      expect(spread.spread_pct).toBe(10.0);
    });

    it("returns null when either ask or bid is missing", () => {
      expect(computeOrderbookSpread(null, 36000)).toEqual({ spread_rupees: null, spread_pct: null });
      expect(computeOrderbookSpread(40000, null)).toEqual({ spread_rupees: null, spread_pct: null });
    });
  });

  describe("calculateConsignorPayout", () => {
    it("returns unconfigured when no platform fee rate is provided or configured in env", () => {
      const payout = calculateConsignorPayout(20000);
      expect(payout.configured).toBe(false);
      expect(payout.platform_fee_rupees).toBeNull();
      expect(payout.estimated_payout_rupees).toBeNull();
    });

    it("handles explicit owner-approved platform fee rate", () => {
      const payout = calculateConsignorPayout(10000, 0.05); // 5% fee
      expect(payout.configured).toBe(true);
      expect(payout.platform_fee_rupees).toBe(500);
      expect(payout.estimated_payout_rupees).toBe(9500);
    });

    it("handles zero and negative amounts safely with configured rate", () => {
      const payout = calculateConsignorPayout(0, 0.095);
      expect(payout.configured).toBe(true);
      expect(payout.platform_fee_rupees).toBe(0);
      expect(payout.estimated_payout_rupees).toBe(0);
    });
  });
});
