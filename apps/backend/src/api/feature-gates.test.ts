import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiLayerEnabled,
  aiLayerGateMiddleware,
  fitStudioEnabled,
  fitStudioGateMiddleware,
  resaleEnabled,
  resaleGateMiddleware,
} from "./middlewares";

/**
 * Feature-gate enforcement at the API boundary.
 *
 * Visibility (nav links, buttons) is presentation; these middlewares are the authorisation.
 * A deferred feature must be unavailable even when a client calls its endpoint directly —
 * direct URL access, hand-built requests or flipped client-side flags must all get 404.
 */

type Gate = (
  req: unknown,
  res: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  },
  next: () => void,
) => Promise<void>;

function harness(gate: Gate) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  const next = vi.fn();
  return { res, next, run: () => gate({}, res, next) };
}

describe("feature gates at the API boundary", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  describe("resale gate (/store/resale/*, /store/inspections/*, /admin/resale*, /admin/inspections*)", () => {
    it("blocks with 404 when neither resale flag is set (default)", async () => {
      delete process.env.ENABLE_RESALE;
      delete process.env.NEXT_PUBLIC_ENABLE_RESALE;
      expect(resaleEnabled()).toBe(false);
      const { res, next, run } = harness(resaleGateMiddleware);
      await run();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ type: "not_found", message: expect.stringContaining("Resale is not enabled") }),
      );
    });

    it("blocks with 404 when the flag is explicitly false", async () => {
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "false";
      const { next, run } = harness(resaleGateMiddleware);
      await run();
      expect(next).not.toHaveBeenCalled();
    });

    it("allows the request through only when the flag is exactly \"true\"", async () => {
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "true";
      const { next, run } = harness(resaleGateMiddleware);
      await run();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("prefers the backend-only ENABLE_RESALE flag over the NEXT_PUBLIC fallback", () => {
      process.env.ENABLE_RESALE = "true";
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "false";
      expect(resaleEnabled()).toBe(true);

      process.env.ENABLE_RESALE = "false";
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "true";
      expect(resaleEnabled()).toBe(false);
    });

    it("never treats a truthy non-\"true\" value as enabled", () => {
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "1";
      expect(resaleEnabled()).toBe(false);
      process.env.NEXT_PUBLIC_ENABLE_RESALE = "TRUE";
      expect(resaleEnabled()).toBe(false);
    });
  });

  describe("AI layer gate (/store/concierge/chat*, /store/sight-search*)", () => {
    it("blocks with 404 when no AI flag is set (default)", async () => {
      delete process.env.FEATURE_AI_LAYER;
      delete process.env.NEXT_PUBLIC_FEATURE_AI_LAYER;
      expect(aiLayerEnabled()).toBe(false);
      const { res, next, run } = harness(aiLayerGateMiddleware);
      await run();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ type: "not_found", message: expect.stringContaining("not enabled") }),
      );
    });

    it("allows the request through only when the AI flag is exactly \"true\"", async () => {
      process.env.FEATURE_AI_LAYER = "true";
      const { next, run } = harness(aiLayerGateMiddleware);
      await run();
      expect(next).toHaveBeenCalledTimes(1);

      process.env.FEATURE_AI_LAYER = "false";
      const blocked = harness(aiLayerGateMiddleware);
      await blocked.run();
      expect(blocked.next).not.toHaveBeenCalled();
    });
  });

  describe("Fit Studio gate (/store/fit/*, /admin/fit-rules*)", () => {
    it("blocks with 404 when no fit flag is set (default)", async () => {
      delete process.env.FEATURE_FIT_STUDIO;
      delete process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO;
      expect(fitStudioEnabled()).toBe(false);
      const { res, next, run } = harness(fitStudioGateMiddleware);
      await run();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ type: "not_found", message: expect.stringContaining("not enabled") }),
      );
    });

    it("allows the request through when the fit flag is exactly \"true\"", async () => {
      process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO = "true";
      const { next, run } = harness(fitStudioGateMiddleware);
      await run();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("gate responses do not leak internal details", () => {
    it("returns a generic feature-unavailable message without naming env vars", async () => {
      delete process.env.FEATURE_AI_LAYER;
      delete process.env.NEXT_PUBLIC_FEATURE_AI_LAYER;
      const { res, run } = harness(aiLayerGateMiddleware);
      await run();
      const body = res.json.mock.calls[0][0] as { message: string };
      expect(body.message).not.toMatch(/env|process|flag|FEATURE_/i);
    });
  });
});
