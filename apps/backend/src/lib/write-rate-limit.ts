import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { actorId } from "./auth";
import { checkRateLimit, type RateLimitPolicy } from "./rate-limit";

/**
 * Rate-limit middleware for public or authenticated write routes.
 *
 * Keyed by the authenticated actor when there is one, otherwise by client IP, and always
 * namespaced per route family so one bucket cannot exhaust another. The limiter itself is
 * Redis-backed when `REDIS_URL` is set, so the limit holds across replicas.
 */
export function rateLimit(
  scope: string,
  policy: RateLimitPolicy,
  options: { byActor?: boolean } = {},
) {
  return async function rateLimitMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) {
    const subject =
      options.byActor && actorId(req)
        ? `actor:${actorId(req)}`
        : `ip:${(req.ip ?? req.socket?.remoteAddress ?? "unknown").toString()}`;

    const result = await checkRateLimit(`${scope}:${subject}`, policy);

    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      res.status(429).json({
        type: "rate_limited",
        message: "Too many requests. Please wait a moment and try again.",
      });
      return;
    }

    next();
  };
}
