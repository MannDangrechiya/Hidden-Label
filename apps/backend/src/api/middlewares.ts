import {
  authenticate,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { defineMiddlewares } from "@medusajs/medusa";
import { canWrite, resolveAdmin } from "../lib/admin-auth";
import { processReturnAction } from "../lib/returns";

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
 * Enforces phone OTP verification on the backend before completing a Cash on Delivery cart.
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
      const cart = await pg("cart").where({ id: cartId }).first("id", "metadata");
      const metadata = (cart?.metadata ?? {}) as Record<string, unknown>;
      const verifiedAt = metadata.cod_otp_verified_at;

      if (!verifiedAt || typeof verifiedAt !== "string") {
        res.status(400).json({
          type: "invalid_data",
          message: "Cash on Delivery requires phone OTP verification before completing the order.",
        });
        return;
      }

      const verifiedTime = new Date(verifiedAt).getTime();
      const now = Date.now();
      if (isNaN(verifiedTime) || now - verifiedTime > 15 * 60 * 1000) {
        res.status(400).json({
          type: "invalid_data",
          message: "Cash on Delivery phone OTP verification has expired. Please verify your phone again.",
        });
        return;
      }
    }
  } catch {
    // Proceed if lookup fails
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

  // Self identity endpoint is accessible by any authenticated admin user
  if (
    path === "/admin/users/me" ||
    path === "/admin/users/me/" ||
    path.endsWith("/users/me") ||
    path.endsWith("/users/me/")
  ) {
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
      matcher: "/store/carts/:id/complete",
      methods: ["POST"],
      middlewares: [codOtpVerificationMiddleware],
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
