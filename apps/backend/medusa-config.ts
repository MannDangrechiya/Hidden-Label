import { defineConfig, loadEnv } from "@medusajs/framework/utils";

// Loads apps/backend/.env — the backend's own env file. Integration secrets live here in
// development and in the host's secret store in production (never in the repository).
loadEnv(process.env.NODE_ENV ?? "development", process.cwd());

const STOREFRONT_ORIGIN = process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "http://localhost:7001";

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Redis backs the event bus, workflow engine and caching. Left unset in local dev so the
    // in-memory modules are used when no Redis is available.
    redisUrl: process.env.REDIS_URL || undefined,
    http: {
      // NOTE: the HTTP port comes from the PORT env var (apps/backend/.env). Without it Medusa
      // binds to 0 — a random ephemeral port — which breaks every client and these CORS origins.
      storeCors: STOREFRONT_ORIGIN,
      adminCors: `${ADMIN_ORIGIN},${STOREFRONT_ORIGIN}`,
      authCors: `${ADMIN_ORIGIN},${STOREFRONT_ORIGIN}`,
      jwtSecret: process.env.MEDUSA_JWT_SECRET ?? "local_dev_jwt_secret",
      cookieSecret: process.env.MEDUSA_COOKIE_SECRET ?? "local_dev_cookie_secret",
    },
  },
  admin: {
    // Custom admin app (Phase 5) is separate; the stock Medusa admin stays available in dev
    // for schema inspection until the custom dashboard replaces it.
    backendUrl: process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000",
  },
  modules: [
    // Project-owned tables: brand, CMS, wishlist, OTP, returns, shipments and the audit log.
    { resolve: "./src/modules/thl" },
  ],
});
