import {
  authenticate,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { defineMiddlewares } from "@medusajs/medusa";
import { adminAccess, decideAdminRequest, stripPrivilegedMetadata } from "../lib/admin-auth";
import { checkAuthRateLimit, resetAuthRateLimit, WRITE_RATE_LIMITS } from "../lib/rate-limit";
import { processReturnAction } from "../lib/returns";
import { checkUploadRequest } from "../lib/upload-validation";
import { rateLimit } from "../lib/write-rate-limit";

/**
 * Validates registration payloads and stops email enumeration.
 */
async function customerRegistrationMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const body = (req.body ?? {}) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || !password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({
      type: "invalid_data",
      message: "A valid email address and password of at least 8 characters are required.",
    });
    return;
  }

  try {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    const existing = await pg("customer").where({ email }).whereNull("deleted_at").first("id");
    if (existing) {
      res.status(400).json({
        type: "invalid_data",
        message: "Unable to complete registration. If you already have an account, please sign in.",
      });
      return;
    }
  } catch {
    // Proceed to core auth if lookup fails
  }

  next();
}

/**
 * GAP-SEC-03: stops credential stuffing and brute-force guessing against customer and staff
 * password logins. Keyed by client IP + submitted email so one attacker cannot lock out every
 * account from a shared NAT address, while repeated guesses against one account still trip.
 */
async function authRateLimitMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const body = (req.body ?? {}) as { email?: string };
  const ip = (req.ip ?? req.socket?.remoteAddress ?? "unknown").toString();
  const key = `${ip}:${(body.email ?? "").trim().toLowerCase()}`;
  const result = await checkAuthRateLimit(key);

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    res.status(429).json({
      type: "rate_limited",
      message: "Too many sign-in attempts. Try again in a few minutes.",
    });
    return;
  }

  res.on("finish", () => {
    // A successful sign-in clears the counter; failures keep accumulating in the window.
    // Fire-and-forget: the response has already been sent, nothing is waiting on this.
    if (res.statusCode >= 200 && res.statusCode < 300) void resetAuthRateLimit(key);
  });

  next();
}

/**
 * Rejects a huge or non-multipart upload before Medusa buffers it. Per-file MIME and size are
 * checked by the admin app (`apps/admin/lib/upload-rules.ts`) before the request is made.
 */
async function uploadRequestGuard(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const check = checkUploadRequest(req.headers as Record<string, string | string[] | undefined>);
  if (!check.ok) {
    res.status(check.status).json({ type: "invalid_data", message: check.message });
    return;
  }
  next();
}

/**
 * Intercepts POST /admin/returns/:id to execute return actions before Medusa's strict core validator rejects them.
 */
async function adminReturnsMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const body = (req.body ?? {}) as { action?: string };
  if (body.action) {
    const path = req.originalUrl || req.path || req.url || "";
    const match = path.match(/\/admin\/returns\/([^/?#]+)/);
    const returnId = (req.params as Record<string, string | undefined>)?.id || match?.[1];
    if (returnId) {
      const handled = await processReturnAction(req, res, returnId);
      if (handled) return;
    }
  }
  next();
}

/**
 * Universal RBAC guard for all /admin/* endpoints.
 *
 * SEC-01: a staff user with no explicit role is denied with 403 here — never treated as owner.
 * The decision itself lives in a pure function (`decideAdminRequest`) so it is unit-tested
 * across every role and the self-escalation paths.
 */
async function adminRbacMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const access = await adminAccess(req);
  if (!access.allowed) {
    res.status(access.status).json({ type: access.code, code: access.code, message: access.message });
    return;
  }

  const rawPath = req.originalUrl || req.path || req.url || "";
  const path = rawPath.split("?")[0];

  const decision = decideAdminRequest({
    role: access.actor.role,
    actorId: access.actor.id,
    method: req.method,
    path,
    body: (req.body ?? null) as Record<string, unknown> | null,
  });

  if (!decision.allow) {
    res.status(decision.status).json({ type: "forbidden", message: decision.message });
    return;
  }

  if (decision.stripPrivilegedMetadata) {
    stripPrivilegedMetadata(req.body as Record<string, unknown> | undefined);
  }

  next();
}

async function adminPromotionBodyMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (req.body && typeof req.body === "object") {
    const body = req.body as Record<string, unknown>;
    if ("usage_limit" in body) {
      if (body.limit === undefined) {
        body.limit = body.usage_limit;
      }
      delete body.usage_limit;
    }
  }
  next();
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/auth/customer/emailpass",
      methods: ["POST"],
      middlewares: [authRateLimitMiddleware],
    },
    {
      matcher: "/auth/user/emailpass",
      methods: ["POST"],
      middlewares: [authRateLimitMiddleware],
    },
    {
      matcher: "/auth/customer/emailpass/register",
      methods: ["POST"],
      middlewares: [customerRegistrationMiddleware],
    },
    {
      matcher: "/store/wishlist*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/returns*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/customers/me*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/orders/*/cancel",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/resale/bids*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/resale/asks*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/fit/profile*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/webhooks/razorpay",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
      middlewares: [],
    },

    // ---- Write rate limits (public / authenticated) ------------------------------------------
    {
      matcher: "/store/otp/send",
      methods: ["POST"],
      middlewares: [rateLimit("otp-send", WRITE_RATE_LIMITS.otpSend)],
    },
    {
      matcher: "/store/support/tickets",
      methods: ["POST"],
      middlewares: [rateLimit("support-ticket", WRITE_RATE_LIMITS.supportTicket)],
    },
    {
      matcher: "/store/concierge/chat",
      methods: ["POST"],
      middlewares: [rateLimit("concierge", WRITE_RATE_LIMITS.concierge)],
    },
    {
      matcher: "/store/sight-search",
      methods: ["POST"],
      middlewares: [rateLimit("sight-search", WRITE_RATE_LIMITS.sightSearch)],
    },
    {
      matcher: "/store/resale/asks*",
      methods: ["POST", "DELETE"],
      middlewares: [rateLimit("resale-asks", WRITE_RATE_LIMITS.resaleWrite, { byActor: true })],
    },
    {
      matcher: "/store/resale/bids*",
      methods: ["POST", "DELETE"],
      middlewares: [rateLimit("resale-bids", WRITE_RATE_LIMITS.resaleWrite, { byActor: true })],
    },
    {
      matcher: "/store/customers/me/delete-account",
      methods: ["POST"],
      middlewares: [
        rateLimit("account-delete", WRITE_RATE_LIMITS.destructiveAccount, { byActor: true }),
      ],
    },

    // ---- Admin -------------------------------------------------------------------------------
    {
      matcher: "/admin/uploads",
      methods: ["POST"],
      middlewares: [uploadRequestGuard],
    },
    {
      matcher: "/admin/promotions*",
      methods: ["POST", "PUT"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        adminPromotionBodyMiddleware,
      ],
    },
    {
      matcher: "/admin/returns/*",
      methods: ["POST"],
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        adminReturnsMiddleware,
      ],
    },
    {
      matcher: "/admin/*",
      middlewares: [
        authenticate("user", ["bearer", "session"]),
        adminRbacMiddleware,
      ],
    },
  ],
});
