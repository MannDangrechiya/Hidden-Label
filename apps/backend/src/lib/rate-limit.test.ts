import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTH_RATE_LIMIT,
  checkRateLimit,
  clearAllRateLimits,
  type RateLimitPolicy,
} from "./rate-limit";

// The limiter coordinates through Redis only when REDIS_URL is configured. These tests exercise
// the in-memory fallback deterministically, which is the same code path used when Redis is down.
delete process.env.REDIS_URL;

const policy: RateLimitPolicy = { windowMs: 1000, max: 3, blockMs: 5000 };

describe("Rate limiting", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  it("allows up to the limit and then denies", async () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      const result = await checkRateLimit("test:one", policy, now + i);
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimit("test:one", policy, now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps buckets independent", async () => {
    const now = 2_000_000;
    for (let i = 0; i < 3; i += 1) await checkRateLimit("test:a", policy, now);
    expect((await checkRateLimit("test:a", policy, now)).allowed).toBe(false);
    expect((await checkRateLimit("test:b", policy, now)).allowed).toBe(true);
  });

  it("releases the bucket once the block and window have passed", async () => {
    const now = 3_000_000;
    for (let i = 0; i < 3; i += 1) await checkRateLimit("test:window", policy, now);
    expect((await checkRateLimit("test:window", policy, now)).allowed).toBe(false);

    // A denial starts a block. Access resumes only after that block expires, not merely after
    // the counting window — otherwise a spammer could reset by waiting one window.
    expect((await checkRateLimit("test:window", policy, now + 10)).allowed).toBe(false);
    expect(
      (await checkRateLimit("test:window", policy, now + policy.blockMs + 1)).allowed,
    ).toBe(true);
  });

  it("enforces the auth policy for repeated sign-in attempts", async () => {
    const now = 4_000_000;
    for (let i = 0; i < AUTH_RATE_LIMIT.max; i += 1) {
      expect((await checkRateLimit("auth:ip:email", AUTH_RATE_LIMIT, now)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit("auth:ip:email", AUTH_RATE_LIMIT, now);
    expect(blocked.allowed).toBe(false);
  });
});
