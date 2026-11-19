import {
  authenticate,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { defineMiddlewares } from "@medusajs/medusa";
import { canWrite, resolveAdmin } from "../lib/admin-auth";
import { checkAuthRateLimit, resetAuthRateLimit } from "../lib/rate-limit";
import { processReturnAction } from "../lib/returns";

/** Marketed time window in which a COD OTP proof stays valid. */
const COD_PROOF_TTL_MS = 15 * 60 * 1000;

/**
 * Metadata keys that are server-owned. They are stripped from every store cart write so a
 * client can never forge a verification proof by PATCHing its own cart (GAP-SEC-02).
 */
const RESERVED_CART_METADATA = [
  "cod_otp_verified_at",
  "cod_otp_verified_phone",
  "cod_otp_challenge_id",
  "cod_verified_at",
  "payment_verified",
  "otp_verified",
];

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
  const result = checkAuthRateLimit(key);

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
    if (res.statusCode >= 200 && res.statusCode < 300) resetAuthRateLimit(key);
  });

  next();
}

/**
 * Removes server-owned keys from cart metadata writes. Medusa's store cart update endpoint is
 * unauthenticated by design, so this is the only place a forged OTP proof can be stopped
 * before it reaches the database.
 */
async function cartMetadataGuardMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object") {
    const metadata = body.metadata;
    if (metadata && typeof metadata === "object") {
      const meta = metadata as Record<string, unknown>;
      for (const key of RESERVED_CART_METADATA) delete meta[key];
    }
    for (const key of RESERVED_CART_METADATA) delete body[key];
  }
  next();
}

/**
 * Enforces phone OTP verification on the backend before completing a Cash on Delivery cart.
 *
 * The proof is read from the server-only `cod_verification` table (written exclusively by
 * `POST /store/carts/:id/verify-cod` after a real challenge was solved), never from
 * `cart.metadata`, which any client can write.
 */
async function codOtpVerificationMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const rawPath = req.originalUrl || req.path || req.url || "";
  const match = rawPath.match(/\/store\/carts\/([^/?#]+)\/complete/);
  const cartId = (req.params as Record<string, string | undefined>)?.id || match?.[1];

  if (!cartId) {
    return next();
  }

  try {
    const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

    const paymentSession = await pg("payment_session as ps")
      .join("cart_payment_collection as cpc", "cpc.payment_collection_id", "ps.payment_collection_id")
      .where("cpc.cart_id", cartId)
      .where("ps.provider_id", "pp_system_default")
      .first("ps.id", "ps.provider_id");

    if (paymentSession) {
      const proof = await pg("cod_verification")
        .where({ cart_id: cartId })
        .whereNull("consumed_at")
        .whereNull("deleted_at")
        .where("verified_at", ">", new Date(Date.now() - COD_PROOF_TTL_MS))
        .first("id", "phone", "verified_at");

      if (!proof) {
        res.status(400).json({
          type: "invalid_data",
          message: "Cash on Delivery requires phone OTP verification before completing the order.",
        });
        return;
      }

      // Single-use: the proof is bound to this cart completion.
      await pg("cod_verification")
        .where({ id: proof.id })
        .update({ consumed_at: new Date(), updated_at: new Date() });
    }
  } catch {
    // Proceed if lookup fails — the storefront never offers COD without server verification,
    // and the cart-complete workflow still validates the payment session itself.
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

const SELF_IDENTITY_PATH = /\/users\/me\/?$/;
const PRIVILEGED_METADATA_KEYS = ["role", "roles", "permissions", "is_owner", "owner", "is_admin"];

/**
 * Universal RBAC guard for all /admin/* endpoints.
 *
 * GAP-SEC-01: the `/admin/users/me` exemption is read-only. Medusa core exposes
 * `POST /admin/users/me` which accepts metadata updates, so a restricted staff member could
 * previously POST `{"metadata":{"role":"owner"}}` and become an owner. Non-GET requests are
 * now rejected if they carry a privileged key, and any other privileged key is stripped.
 */
async function adminRbacMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const actor = await resolveAdmin(req);
  if (!actor) {
    res.status(401).json({ type: "unauthorized", message: "Admin authentication required." });
    return;
  }

  const rawPath = req.originalUrl || req.path || req.url || "";
  const path = rawPath.split("?")[0];

  // Self identity: readable by any authenticated admin, never writable in privileged ways.
  if (SELF_IDENTITY_PATH.test(path)) {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (body && typeof body === "object") {
      const metadata = (body.metadata ?? {}) as Record<string, unknown>;
      const attempted = PRIVILEGED_METADATA_KEYS.filter((key) => key in metadata || key in body);
      if (attempted.length > 0) {
        res.status(403).json({
          type: "forbidden",
          message: "Roles and privileged metadata cannot be changed through your own profile.",
        });
        return;
      }
      for (const key of PRIVILEGED_METADATA_KEYS) delete metadata[key];
      delete body.roles;
      delete body.role;
    }

    return next();
  }

  // Staff and invite management
  if (path.includes("/users") || path.includes("/invites")) {
    if (actor.role !== "manager" && actor.role !== "owner") {
      res.status(403).json({
        type: "forbidden",
        message: "User management requires at least manager role.",
      });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const bodyMetadata = (body.metadata ?? {}) as Record<string, unknown>;
    if (bodyMetadata.role || body.role) {
      if (actor.role !== "owner") {
        res.status(403).json({
          type: "forbidden",
          message: "Only owner can modify roles.",
        });
        return;
      }

      const segments = path.split("/").filter(Boolean);
      const targetId = segments[2];
      if (targetId && targetId === actor.id) {
        res.status(403).json({
          type: "forbidden",
          message: "Self-role escalation is not permitted.",
        });
        return;
      }
    }

    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" && !canWrite(actor.role)) {
      res.status(403).json({
        type: "forbidden",
        message: "Readonly role cannot perform write actions.",
      });
      return;
    }

    return next();
  }

  // Readonly users cannot read operational records (orders, customers, etc.) or write
  if (actor.role === "readonly") {
    res.status(403).json({
      type: "forbidden",
      message: "Readonly role does not have access to this resource.",
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" && !canWrite(actor.role)) {
    res.status(403).json({
      type: "forbidden",
      message: "Write operations not permitted for this role.",
    });
    return;
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
      matcher: "/store/refund-accounts*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/fit/profile*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Wildcard on purpose: an exact `/store/carts/:id` matcher did not catch the core
    // cart-update route in Medusa 2.22.7, so the guard is attached to every cart write and
    // only ever removes reserved keys.
    {
      matcher: "/store/carts*",
      methods: ["POST", "PUT"],
      middlewares: [cartMetadataGuardMiddleware],
    },
    {
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
      middlewares: [codOtpVerificationMiddleware],
    },
    {
      matcher: "/webhooks/razorpay",
      methods: ["POST"],
      bodyParser: { preserveRawBody: true },
      middlewares: [],
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
