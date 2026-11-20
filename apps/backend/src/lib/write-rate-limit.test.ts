import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAllRateLimits, type RateLimitPolicy } from "./rate-limit";
import { rateLimit } from "./write-rate-limit";

delete process.env.REDIS_URL;

const policy: RateLimitPolicy = { windowMs: 60_000, max: 2, blockMs: 60_000 };

interface Capture {
  statusCode: number;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
  nextCalled: boolean;
}

function makeRes(capture: Capture): MedusaResponse {
  const res = {
    status(code: number) {
      capture.statusCode = code;
      return res;
    },
    json(payload: Record<string, unknown>) {
      capture.body = payload;
      return res;
    },
    setHeader(key: string, value: string) {
      capture.headers[key] = value;
      return res;
    },
  };
  return res as unknown as MedusaResponse;
}

async function invoke(
  middleware: ReturnType<typeof rateLimit>,
  req: { ip?: string; auth_context?: { actor_id: string } },
): Promise<Capture> {
  const capture: Capture = { statusCode: 200, body: null, headers: {}, nextCalled: false };
  const next = (() => {
    capture.nextCalled = true;
  }) as unknown as MedusaNextFunction;

  await middleware(
    { ...req, headers: {}, socket: {} } as unknown as MedusaRequest,
    makeRes(capture),
    next,
  );
  return capture;
}

describe("Write-route rate limiting middleware", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  it("passes requests through until the limit, then answers 429 without calling next", async () => {
    delete process.env.REDIS_URL;
    const middleware = rateLimit("test-scope", policy);
    const req = { ip: "203.0.113.7" };

    const first = await invoke(middleware, req);
    const second = await invoke(middleware, req);
    expect(first.nextCalled).toBe(true);
    expect(second.nextCalled).toBe(true);

    const third = await invoke(middleware, req);
    expect(third.nextCalled).toBe(false);
    expect(third.statusCode).toBe(429);
    expect(third.body?.type).toBe("rate_limited");
    expect(Number(third.headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("keeps different clients in separate buckets", async () => {
    delete process.env.REDIS_URL;
    const middleware = rateLimit("test-scope-2", policy);

    for (let i = 0; i < 3; i += 1) await invoke(middleware, { ip: "203.0.113.9" });
    const blocked = await invoke(middleware, { ip: "203.0.113.9" });
    expect(blocked.statusCode).toBe(429);

    const otherClient = await invoke(middleware, { ip: "203.0.113.10" });
    expect(otherClient.nextCalled).toBe(true);
  });

  it("buckets authenticated writes by actor when asked", async () => {
    delete process.env.REDIS_URL;
    const middleware = rateLimit("test-scope-actor", policy, { byActor: true });

    for (let i = 0; i < 3; i += 1) {
      await invoke(middleware, { ip: "203.0.113.20", auth_context: { actor_id: "cus_1" } });
    }
    const blocked = await invoke(middleware, {
      ip: "203.0.113.20",
      auth_context: { actor_id: "cus_1" },
    });
    expect(blocked.statusCode).toBe(429);

    // Same IP, different customer: their own bucket is untouched.
    const otherActor = await invoke(middleware, {
      ip: "203.0.113.20",
      auth_context: { actor_id: "cus_2" },
    });
    expect(otherActor.nextCalled).toBe(true);
  });
});
