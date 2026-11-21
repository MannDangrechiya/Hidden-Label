import { defineConfig, loadEnv } from "@medusajs/framework/utils";
import { assertProductionEnv } from "./src/lib/env-guard";

// Loads apps/backend/.env — the backend's own env file. Integration secrets live here in
// development and in the host's secret store in production (never in the repository).
loadEnv(process.env.NODE_ENV ?? "development", process.cwd());

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// GAP-116: a production process with missing or development secret values must not start. The
// check reports variable names only, never values. Development keeps its convenience defaults.
if (IS_PRODUCTION) {
  assertProductionEnv(process.env as Record<string, string | undefined>);
}

const STOREFRONT_ORIGIN = process.env.STOREFRONT_ORIGIN ?? "http://localhost:3000";
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "http://localhost:7001";
const JWT_SECRET = process.env.MEDUSA_JWT_SECRET ?? (IS_PRODUCTION ? "" : "local_dev_jwt_secret");
const COOKIE_SECRET =
  process.env.MEDUSA_COOKIE_SECRET ?? (IS_PRODUCTION ? "" : "local_dev_cookie_secret");

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Without this, knex defaults to a 10-connection pool per process — fine for local dev,
    // not for concurrent traffic. DB_POOL_MAX should stay well under Postgres's own
    // max_connections divided by the number of backend replicas (each replica gets its own
    // pool of this size).
    databaseDriverOptions: {
      pool: {
        min: Number(process.env.DB_POOL_MIN ?? 2),
        max: Number(process.env.DB_POOL_MAX ?? 20),
      },
    },
    // Redis backs the event bus, workflow engine and caching. Left unset in local dev so the
    // in-memory modules are used when no Redis is available.
    redisUrl: process.env.REDIS_URL || undefined,
    http: {
      // NOTE: the HTTP port comes from the PORT env var (apps/backend/.env). Without it Medusa
      // binds to 0 — a random ephemeral port — which breaks every client and these CORS origins.
      storeCors: STOREFRONT_ORIGIN,
      adminCors: `${ADMIN_ORIGIN},${STOREFRONT_ORIGIN}`,
      authCors: `${ADMIN_ORIGIN},${STOREFRONT_ORIGIN}`,
      jwtSecret: JWT_SECRET,
      cookieSecret: COOKIE_SECRET,
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
    // Payment module: prepaid only. `pp_system_default` is Medusa's built-in provider and is
    // deliberately unlinked from the INR region by setup-payments.ts, so the store API never
    // offers it. Razorpay is always registered (so the code path and types are real, not dead
    // code), but its methods refuse to call out without RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/razorpay",
            id: "razorpay",
            options: {
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
              api_url: process.env.RAZORPAY_API_URL,
            },
          },
        ],
      },
    },
  ],
});
