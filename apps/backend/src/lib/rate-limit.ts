/**
 * GAP-SEC-03: sliding-window limiter for auth endpoints.
 *
 * A single Medusa instance can use a process-local map safely. Behind more than one replica a
 * per-process counter allows `replicas × limit` attempts, since each replica only sees its own
 * share of traffic — so when `REDIS_URL` is configured this coordinates through Redis instead
 * (the same store already shared across replicas for the event bus/workflow engine), and only
 * falls back to the in-memory map when Redis is unset or unreachable. Documented in
 * REMEDIATION_EXECUTION_REPORT.md §Phase 1.
 */
import Redis from "ioredis";

interface Bucket {
  hits: number[];
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_KEYS = 10_000;

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

function checkInMemory(key: string, now: number): RateLimitResult {
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

  bucket.hits = bucket.hits.filter((at) => now - at < WINDOW_MS);

  if (bucket.hits.length >= MAX_ATTEMPTS) {
    bucket.blockedUntil = now + BLOCK_MS;
    buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000), remaining: 0 };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0, remaining: MAX_ATTEMPTS - bucket.hits.length };
}

function resetInMemory(key: string): void {
  buckets.delete(key);
}

async function checkViaRedis(redis: Redis, key: string, now: number): Promise<RateLimitResult> {
  const blockKey = `ratelimit:block:${key}`;
  const windowKey = `ratelimit:hits:${key}`;

  const blockedUntilRaw = await redis.get(blockKey);
  if (blockedUntilRaw) {
    const blockedUntil = Number(blockedUntilRaw);
    if (blockedUntil > now) {
      return { allowed: false, retryAfterSeconds: Math.ceil((blockedUntil - now) / 1000), remaining: 0 };
    }
  }

  // One round trip: drop expired hits, record this one, count what's left, refresh the TTL.
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(windowKey, 0, now - WINDOW_MS);
  pipeline.zadd(windowKey, now, `${now}:${Math.random()}`);
  pipeline.zcard(windowKey);
  pipeline.pexpire(windowKey, WINDOW_MS);
  const results = await pipeline.exec();
  const count = Number(results?.[2]?.[1] ?? 0);

  if (count > MAX_ATTEMPTS) {
    const blockedUntil = now + BLOCK_MS;
    await redis.set(blockKey, String(blockedUntil), "PX", BLOCK_MS);
    return { allowed: false, retryAfterSeconds: Math.ceil(BLOCK_MS / 1000), remaining: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, MAX_ATTEMPTS - count) };
}

export async function checkAuthRateLimit(key: string, now = Date.now()): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try {
      return await checkViaRedis(redis, key, now);
    } catch {
      // Redis is configured but unreachable right now — fail open to the local map rather than
      // either blocking every login or skipping the limit entirely.
    }
  }
  return checkInMemory(key, now);
}

/** Clears a bucket after a successful sign-in so a legitimate user is not locked out. */
export async function resetAuthRateLimit(key: string): Promise<void> {
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

/** Test/ops helper — never exposed over HTTP. */
export function clearAllRateLimits(): void {
  buckets.clear();
}
