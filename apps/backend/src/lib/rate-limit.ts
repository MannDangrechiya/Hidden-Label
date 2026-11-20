/**
 * GAP-SEC-03: sliding-window limiter shared by authentication, OTP and public write routes.
 *
 * A single Medusa instance can use a process-local map safely. Behind more than one replica a
 * per-process counter allows `replicas × limit` attempts, since each replica only sees its own
 * share — so when `REDIS_URL` is configured this coordinates through Redis and only falls back
 * to the in-memory map when Redis is unset or unreachable.
 */
import Redis from "ioredis";

interface Bucket {
  hits: number[];
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitPolicy {
  windowMs: number;
  max: number;
  blockMs: number;
}

/** Login/brute-force policy — unchanged from the previous behaviour. */
export const AUTH_RATE_LIMIT: RateLimitPolicy = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  blockMs: 15 * 60 * 1000,
};

export const WRITE_RATE_LIMITS = {
  /** Customer support tickets: a real person writes a handful, not dozens, per hour. */
  supportTicket: { windowMs: 60 * 60 * 1000, max: 5, blockMs: 60 * 60 * 1000 },
  /** AI concierge — every message can cost a paid model call. */
  concierge: { windowMs: 60 * 1000, max: 15, blockMs: 5 * 60 * 1000 },
  /** Sight search — paid model call, image or keyword. */
  sightSearch: { windowMs: 60 * 1000, max: 10, blockMs: 5 * 60 * 1000 },
  /** Resale asks/bids — writes against the orderbook. */
  resaleWrite: { windowMs: 60 * 1000, max: 10, blockMs: 10 * 60 * 1000 },
  /** OTP dispatch has its own per-destination limit in the route; this bounds one IP. */
  otpSend: { windowMs: 15 * 60 * 1000, max: 10, blockMs: 15 * 60 * 1000 },
  /** Account deletion and other irreversible self-service writes. */
  destructiveAccount: { windowMs: 60 * 60 * 1000, max: 3, blockMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitPolicy>;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

let redisClient: Redis | null | undefined; // undefined = not yet attempted

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // never block a request retrying a dead connection
  });
  redisClient.on("error", () => {
    // Swallow: every call below has its own try/catch and falls back to the in-memory map.
    // Logging here would spam on every reconnect attempt against a genuinely down Redis.
  });
  return redisClient;
}

function checkInMemory(key: string, policy: RateLimitPolicy, now: number): RateLimitResult {
  if (buckets.size > MAX_KEYS) {
    // Bound memory: drop the oldest bucket. Auth traffic is low volume; this never
    // evicts an active attacker before its window closes in practice.
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }

  const bucket = buckets.get(key) ?? { hits: [], blockedUntil: 0 };

  if (bucket.blockedUntil > now) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000),
      remaining: 0,
    };
  }

  bucket.hits = bucket.hits.filter((at) => now - at < policy.windowMs);

  if (bucket.hits.length >= policy.max) {
    bucket.blockedUntil = now + policy.blockMs;
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds: Math.ceil(policy.blockMs / 1000), remaining: 0 };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0, remaining: policy.max - bucket.hits.length };
}

function resetInMemory(key: string): void {
  buckets.delete(key);
}

async function checkViaRedis(
  redis: Redis,
  key: string,
  policy: RateLimitPolicy,
  now: number,
): Promise<RateLimitResult> {
  const blockKey = `ratelimit:block:${key}`;
  const windowKey = `ratelimit:hits:${key}`;

  const blockedUntilRaw = await redis.get(blockKey);
  if (blockedUntilRaw) {
    const blockedUntil = Number(blockedUntilRaw);
    if (blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000),
        remaining: 0,
      };
    }
  }

  // One round trip: drop expired hits, record this one, count what's left, refresh the TTL.
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(windowKey, 0, now - policy.windowMs);
  pipeline.zadd(windowKey, now, `${now}:${Math.random()}`);
  pipeline.zcard(windowKey);
  pipeline.pexpire(windowKey, policy.windowMs);
  const results = await pipeline.exec();
  const count = Number(results?.[2]?.[1] ?? 0);

  if (count > policy.max) {
    const blockedUntil = now + policy.blockMs;
    await redis.set(blockKey, String(blockedUntil), "PX", policy.blockMs);
    return { allowed: false, retryAfterSeconds: Math.ceil(policy.blockMs / 1000), remaining: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, policy.max - count) };
}

export async function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try {
      return await checkViaRedis(redis, key, policy, now);
    } catch {
      // Redis is configured but unreachable right now — fail open to the local map rather than
      // either blocking every request or skipping the limit entirely.
    }
  }
  return checkInMemory(key, policy, now);
}

export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`ratelimit:block:${key}`, `ratelimit:hits:${key}`);
      return;
    } catch {
      // Fall through to clearing the local copy too.
    }
  }
  resetInMemory(key);
}

export function checkAuthRateLimit(key: string, now = Date.now()): Promise<RateLimitResult> {
  return checkRateLimit(key, AUTH_RATE_LIMIT, now);
}

/** Clears a bucket after a successful sign-in so a legitimate user is not locked out. */
export function resetAuthRateLimit(key: string): Promise<void> {
  return resetRateLimit(key);
}

/** Test/ops helper — never exposed over HTTP. */
export function clearAllRateLimits(): void {
  buckets.clear();
}
