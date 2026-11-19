/**
 * GAP-SEC-03: in-process sliding-window limiter for auth endpoints.
 *
 * A single Medusa instance is the supported deployment today, so a process-local map is
 * accurate there. When the backend runs behind more than one replica, point this at the
 * shared Redis (`REDIS_URL`) or move the limit to the edge/WAF — a per-process counter
 * would otherwise allow `replicas × limit` attempts. Documented in
 * REMEDIATION_EXECUTION_REPORT.md §Phase 1.
 */
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

export function checkAuthRateLimit(key: string, now = Date.now()): RateLimitResult {
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

/** Clears a bucket after a successful sign-in so a legitimate user is not locked out. */
export function resetAuthRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test/ops helper — never exposed over HTTP. */
export function clearAllRateLimits(): void {
  buckets.clear();
}
