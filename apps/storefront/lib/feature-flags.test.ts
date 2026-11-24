import { afterEach, describe, expect, it } from "vitest";
import {
  aiLayerEnabled,
  biddingEnabled,
  fitStudioEnabled,
  resaleEnabled,
} from "./feature-flags";

/**
 * Feature-flag coupling regressions.
 *
 * The audited bug: with `NEXT_PUBLIC_FEATURE_BIDDING=true` but the resale programme off, the
 * product page still rendered a "Place Bid" action whose API (/store/resale/bids) is gated on
 * resale — a CTA that could never succeed, pointing at a disabled feature. Bidding is a resale
 * capability, so `biddingEnabled()` must require BOTH flags.
 */
describe("storefront feature flags", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    delete process.env.NEXT_PUBLIC_ENABLE_RESALE;
    delete process.env.NEXT_PUBLIC_FEATURE_BIDDING;
    delete process.env.NEXT_PUBLIC_FEATURE_AI_LAYER;
    delete process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO;
  });

  describe("bidding requires the resale programme (the audited leak)", () => {
    it("is disabled when bidding flag is on but resale is off", () => {
      delete process.env.NEXT_PUBLIC_ENABLE_RESALE;
      process.env.NEXT_PUBLIC_FEATURE_BIDDING = "true";
      expect(resaleEnabled()).toBe(false);
      expect(biddingEnabled()).toBe(false);
    });

    it("is disabled when resale is on but the bidding flag is off", () => {
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "true";
      delete process.env.NEXT_PUBLIC_FEATURE_BIDDING;
      expect(biddingEnabled()).toBe(false);
    });

    it("is enabled only when both flags are exactly \"true\"", () => {
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "true";
      process.env.NEXT_PUBLIC_FEATURE_BIDDING = "true";
      expect(biddingEnabled()).toBe(true);
    });

    it("never treats truthy look-alikes as enabled", () => {
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "1";
      process.env.NEXT_PUBLIC_FEATURE_BIDDING = "TRUE";
      expect(biddingEnabled()).toBe(false);
    });
  });

  describe("defaults are off", () => {
    it("resale, AI layer and Fit Studio are all disabled with no flags set", () => {
      expect(resaleEnabled()).toBe(false);
      expect(aiLayerEnabled()).toBe(false);
      expect(fitStudioEnabled()).toBe(false);
    });

    it("each flag turns its own feature on without enabling anything else", () => {
      process.env.NEXT_PUBLIC_FEATURE_AI_LAYER = "true";
      expect(aiLayerEnabled()).toBe(true);
      expect(resaleEnabled()).toBe(false);
      expect(fitStudioEnabled()).toBe(false);
    });
  });
});
