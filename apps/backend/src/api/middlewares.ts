import {
  authenticate,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { defineMiddlewares } from "@medusajs/medusa";
import type { Knex } from "knex";
import { adminAccess, decideAdminRequest, stripPrivilegedMetadata } from "../lib/admin-auth";
import {
  claimPaymentOperation,
  completePaymentOperation,
  failPaymentOperation,
  type PaymentOperationRow,
} from "../lib/payment-operations";
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
 * Resale/consignment rollout gate.
 *
 * Hiding the storefront "Sell" link and the admin nav entries is presentation, not
 * authorisation: with resale switched off a signed-in customer could still POST
 * /store/resale/asks, place bids or read the orderbook, and staff could still publish stock
 * from and settle consignor asks. Enabled only when explicitly set to "true";
 * `NEXT_PUBLIC_ENABLE_RESALE` is the fallback because that is the flag the apps already read.
 */
export function resaleEnabled(): boolean {
  const flag = process.env.ENABLE_RESALE ?? process.env.NEXT_PUBLIC_ENABLE_RESALE;
  return flag === "true";
}

/**
 * AI rollout gate. Same principle as the resale gate: hiding the concierge widget and the
 * Search-by-Sight entry point is presentation, not authorisation — without a server-side gate,
 * POST /store/concierge/chat and POST /store/sight-search stay fully callable while the
 * storefront hides the buttons. Both are honest keyword/grounded-catalogue features with a
 * real optional Gemini backend, but they only ship to customers when the AI layer flag is
 * explicitly approved on both sides. Enabled only when explicitly set to "true".
 */
export function aiLayerEnabled(): boolean {
  const flag = process.env.FEATURE_AI_LAYER ?? process.env.NEXT_PUBLIC_FEATURE_AI_LAYER;
  return flag === "true";
}

export async function aiLayerGateMiddleware(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (aiLayerEnabled()) {
    next();
    return;
  }
  res.status(404).json({ type: "not_found", message: "This feature is not enabled on this store." });
}

/**
 * Fit Studio rollout gate, mirroring the resale and AI gates: the storefront and admin hide
 * their entries via NEXT_PUBLIC_FEATURE_FIT_STUDIO, and the fit profile / recommendation and
 * fit-rule APIs refuse to operate without the same explicit approval.
 */
export function fitStudioEnabled(): boolean {
  const flag = process.env.FEATURE_FIT_STUDIO ?? process.env.NEXT_PUBLIC_FEATURE_FIT_STUDIO;
  return flag === "true";
}

export async function fitStudioGateMiddleware(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (fitStudioEnabled()) {
    next();
    return;
  }
  res.status(404).json({ type: "not_found", message: "This feature is not enabled on this store." });
}

export async function resaleGateMiddleware(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (resaleEnabled()) {
    next();
    return;
  }
  res.status(404).json({ type: "not_found", message: "Resale is not enabled on this store." });
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

/**
 * Intercepts POST /store/carts/:id/complete to integrate `payment_operation` idempotency,
 * atomic database locking, and duplicate protection into the authoritative checkout flow.
 *
 * Guarantees:
 *  1. If cart is already linked to an order in `order_cart`, immediately returns the existing order.
 *  2. If a Razorpay payment session exists:
 *     - Atomically claims `payment_operation`.
 *     - If already claimed and completed, returns existing order (`duplicate`).
 *     - If another process is currently completing the cart, polls briefly (up to 3s) and returns order or 409 conflict.
 *     - If marked failed and cannot retry, returns 400 with failure reason.
 *     - If successfully claimed: wraps `res.json` to atomically mark the operation completed on order creation
 *       or failed on error, then calls `next()`.
 *  3. If not a Razorpay flow or missing session, proceeds directly to Medusa's core handler.
 */
async function cartCompletePaymentOperationMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const rawPath = req.originalUrl || req.path || req.url || "";
  const match = rawPath.match(/\/store\/carts\/([^/?#]+)\/complete/);
  const cartId = (req.params as Record<string, string | undefined>)?.id || match?.[1];

  if (!cartId) {
    next();
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as Knex;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    // 1. Authoritative check: has the cart already been completed into an order?
    const existingLink = (await pg("order_cart")
      .where({ cart_id: cartId })
      .first("order_id")) as { order_id: string } | undefined;

    if (existingLink?.order_id) {
      const existingOrder = await pg("order")
        .where({ id: existingLink.order_id })
        .first("id", "display_id", "status", "currency_code", "created_at");

      res.status(200).json({ type: "order", order: existingOrder });
      return;
    }

    // 2. Inspect payment session for this cart
    const cartCol = (await pg("cart_payment_collection")
      .where({ cart_id: cartId })
      .whereNull("deleted_at")
      .first("payment_collection_id")) as { payment_collection_id: string } | undefined;

    if (!cartCol?.payment_collection_id) {
      next();
      return;
    }

    const session = (await pg("payment_session")
      .where({ payment_collection_id: cartCol.payment_collection_id })
      .whereNull("deleted_at")
      .orderBy("created_at", "desc")
      .first()) as
      | {
          id: string;
          provider_id: string;
          amount: number | string;
          currency_code: string;
          data?: Record<string, unknown>;
        }
      | undefined;

    if (!session || !session.data) {
      next();
      return;
    }

    const sessionData = (session.data ?? {}) as Record<string, unknown>;
    const clientData = ((sessionData.client ?? {}) as Record<string, unknown>) ?? {};
    const razorpayOrderId = (clientData.razorpay_order_id ?? sessionData.razorpay_order_id) as
      | string
      | undefined;
    const razorpayPaymentId = (clientData.razorpay_payment_id ?? sessionData.razorpay_payment_id) as
      | string
      | undefined;

    // Only apply payment_operation claim if Razorpay order & payment credentials are present
    if (!razorpayOrderId || !razorpayPaymentId) {
      next();
      return;
    }

    const amountPaise = sessionData.amount
      ? Number(sessionData.amount)
      : Math.round(Number(session.amount || 0) * 100);

    // 3. Atomically claim payment operation
    const claim = await claimPaymentOperation(pg, {
      cartId,
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise,
      currencyCode: session.currency_code,
    });

    if (claim.state === "duplicate") {
      const order = await pg("order")
        .where({ id: claim.orderId })
        .first("id", "display_id", "status", "currency_code", "created_at");
      res.status(200).json({ type: "order", order });
      return;
    }

    if (claim.state === "failed") {
      res.status(400).json({
        type: "payment_failed",
        message: claim.error ?? "Payment operation has previously failed for this transaction.",
      });
      return;
    }

    if (claim.state === "in_progress") {
      // Poll briefly (up to 3s) for the active operation to complete
      const start = Date.now();
      let resolvedOrder: unknown = null;
      while (Date.now() - start < 3000) {
        await new Promise((r) => setTimeout(r, 250));
        const check = (await pg("payment_operation")
          .where({ idempotency_key: claim.idempotencyKey })
          .first()) as PaymentOperationRow | undefined;

        if (check?.status === "completed" && check.order_id) {
          resolvedOrder = await pg("order")
            .where({ id: check.order_id })
            .first("id", "display_id", "status", "currency_code", "created_at");
          break;
        }
        if (check?.status === "failed") {
          res.status(400).json({
            type: "payment_failed",
            message: check.error ?? "Payment completion failed.",
          });
          return;
        }
      }

      if (resolvedOrder) {
        res.status(200).json({ type: "order", order: resolvedOrder });
        return;
      }

      res.status(409).json({
        type: "conflict",
        message: "Payment completion is currently in progress. Please check your order status.",
      });
      return;
    }

    // 4. claim.state === "claimed": wrap response handler to record completion / failure
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const responseBody = body as {
        type?: string;
        order?: { id?: string };
        error?: { message?: string };
        message?: string;
      };

      if (responseBody?.type === "order" && responseBody.order?.id) {
        void completePaymentOperation(pg, claim.idempotencyKey, responseBody.order.id).catch(
          (err) => {
            logger.error(`Failed to mark payment operation completed: ${err}`);
          },
        );
      } else if (responseBody?.type === "cart" && responseBody.error) {
        const errMsg = responseBody.error.message ?? JSON.stringify(responseBody.error);
        void failPaymentOperation(pg, claim.idempotencyKey, errMsg).catch((err) => {
          logger.error(`Failed to mark payment operation failed: ${err}`);
        });
      } else if (res.statusCode >= 400) {
        const errMsg = responseBody?.message ?? `HTTP ${res.statusCode}`;
        void failPaymentOperation(pg, claim.idempotencyKey, errMsg).catch((err) => {
          logger.error(`Failed to mark payment operation failed: ${err}`);
        });
      }

      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.error(`cartCompletePaymentOperationMiddleware encountered error: ${error}`);
    next();
  }
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/carts/*/complete",
      methods: ["POST"],
      middlewares: [cartCompletePaymentOperationMiddleware],
    },
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

    // ---- Resale rollout gate (server-side, not just hidden links) ------------------------------
    {
      matcher: "/store/resale/asks*",
      middlewares: [resaleGateMiddleware],
    },
    {
      matcher: "/store/resale/bids*",
      middlewares: [resaleGateMiddleware],
    },
    {
      matcher: "/store/resale/products*",
      middlewares: [resaleGateMiddleware],
    },
    {
      matcher: "/admin/resale*",
      middlewares: [resaleGateMiddleware],
    },
    {
      matcher: "/admin/inspections*",
      middlewares: [resaleGateMiddleware],
    },
    // Storefront inspection certificates are part of the resale programme: the /inspection/[serial]
    // page is gated on the same flag, so the report API must refuse to serve when it is off.
    {
      matcher: "/store/inspections*",
      middlewares: [resaleGateMiddleware],
    },

    // ---- AI rollout gate (server-side, not just hidden entry points) ------------------------
    {
      matcher: "/store/concierge/chat*",
      middlewares: [aiLayerGateMiddleware],
    },
    {
      matcher: "/store/sight-search*",
      middlewares: [aiLayerGateMiddleware],
    },

    // ---- Fit Studio rollout gate -----------------------------------------------------------
    {
      matcher: "/store/fit/*",
      middlewares: [fitStudioGateMiddleware],
    },
    {
      matcher: "/admin/fit-rules*",
      middlewares: [fitStudioGateMiddleware],
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
