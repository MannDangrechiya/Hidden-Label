import { authenticate } from "@medusajs/framework/http";
import { defineMiddlewares } from "@medusajs/medusa";

/**
 * Every private route is authenticated here, server-side. The storefront session is a customer
 * bearer token; the admin app has its own token scope. A signed-out request never reaches the
 * handler.
 */
export default defineMiddlewares({
  routes: [
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
      matcher: "/admin/*",
      middlewares: [authenticate("user", ["bearer", "session"])],
      // Webhooks and the public store API live under /store, so every /admin route is private.
    },
  ],
});
