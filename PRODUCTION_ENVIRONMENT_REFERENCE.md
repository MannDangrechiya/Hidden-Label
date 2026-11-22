# THE HIDDEN LABEL — PRODUCTION ENVIRONMENT CONFIGURATION REFERENCE

This document serves as the canonical specification for every environment variable across **THE HIDDEN LABEL** monorepo.

---

## 1. Environment Architecture & Scoping

Environment variables are isolated into three application files and one infrastructure layer. Secrets must never be committed to git or exposed to client browsers.

```
deploy/
├── docker-compose.prod.yml       <-- Reads host environment or .env for Compose interpolations
apps/
├── backend/.env.production       <-- Medusa server, database, payment, logistics, communications
├── storefront/.env.production    <-- Next.js customer storefront, public URLs, public API keys
└── admin/.env.production         <-- Next.js admin console, backend internal URL, session secrets
```

---

## 2. Infrastructure & Database Variables (Compose Level)

Configured in the host root environment file or injected into `docker-compose.prod.yml`:

| Variable Name | Required? | Secret? | Format / Allowed Values | Purpose & Codebase Usage |
|---|---|---|---|---|
| `POSTGRES_USER` | Yes | No | Alphanumeric (e.g. `thl_prod_user`) | Database master username initialized by `postgres:18-alpine`. |
| `POSTGRES_PASSWORD` | **Yes** | **YES** | Minimum 24 chars random string | Database master password. Compose aborts if omitted (`:?`). |
| `POSTGRES_DB` | Yes | No | Alphanumeric (e.g. `the_hidden_label`) | Default database name. |
| `REDIS_PASSWORD` | **Yes** | **YES** | Minimum 24 chars random string | Auth password required for Redis (`--requirepass`). |

---

## 3. Backend Engine Variables (`apps/backend/.env.production`)

Validated at boot by `apps/backend/src/lib/env-guard.ts`:

### A. Core Runtime & Security
| Variable Name | Required? | Secret? | Format / Validation Rules | Purpose & Behavior |
|---|---|---|---|---|
| `NODE_ENV` | Yes | No | Must be `"production"` | Activates production optimizations and strict `env-guard`. |
| `PORT` | Yes | No | Integer (e.g. `9000`) | Port bound by Medusa HTTP server. |
| `DATABASE_URL` | **Yes** | **YES** | `postgres://user:pass@host:5432/db` | Connection string for PostgreSQL 18. |
| `DATABASE_SSL` | Yes | No | `"true"` or `"false"` | Enables SSL connection to database. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Yes | No | `"true"` or `"false"` | Rejects self-signed database certificates in production. |
| `DB_POOL_MIN` | No | No | Integer (default: `2`) | Minimum connection pool size. |
| `DB_POOL_MAX` | No | No | Integer (default: `20`) | Maximum connection pool size per backend replica. |
| `REDIS_URL` | **Yes** | **YES** | `redis://:pass@host:6379` | Distributed locks, cache, event bus, and rate limiter. |
| `MEDUSA_JWT_SECRET` | **Yes** | **YES** | Random hex string `>= 32` characters | Signs admin & customer JWT tokens. Aborts if default or `< 32`. |
| `MEDUSA_COOKIE_SECRET` | **Yes** | **YES** | Random hex string `>= 32` characters | Signs HTTP-only session cookies. Must differ from JWT secret. |
| `STOREFRONT_ORIGIN` | **Yes** | No | Must start with `https://` | Store CORS allowlist (e.g. `https://thehiddenlabel.com`). |
| `ADMIN_ORIGIN` | **Yes** | No | Must start with `https://` | Admin CORS allowlist (e.g. `https://admin.thehiddenlabel.com`). |

### B. Payment Rails (Razorpay)
| Variable Name | Required? | Secret? | Format / Validation Rules | Purpose & Behavior |
|---|---|---|---|---|
| `RAZORPAY_KEY_ID` | **Yes** | No | `rzp_live_[A-Za-z0-9]+` | Public Razorpay merchant key ID. |
| `RAZORPAY_KEY_SECRET` | **Yes** | **YES** | 32-40 char secret string | Server-to-server Razorpay API secret. |
| `RAZORPAY_WEBHOOK_SECRET` | **Yes** | **YES** | Secret string | Validates HMAC-SHA256 signature on incoming payment webhooks. |

### C. Logistics & Courier (Shiprocket)
| Variable Name | Required? | Secret? | Format / Validation Rules | Purpose & Behavior |
|---|---|---|---|---|
| `SHIPROCKET_EMAIL` | **Yes** | No | Valid email address | Commercial Shiprocket merchant account login. |
| `SHIPROCKET_PASSWORD` | **Yes** | **YES** | Account password | Shiprocket API authentication. |
| `SHIPROCKET_WEBHOOK_TOKEN` | **Yes** | **YES** | Pre-shared token (min 32 chars) | Validates `x-webhook-token` on incoming tracking webhooks. |
| `SHIPROCKET_PICKUP_LOCATION`| Yes | No | String (e.g. `WH_AHMEDABAD_HQ`) | Warehouse pickup name registered in Shiprocket. |

### D. Transactional Communications
| Variable Name | Required? | Secret? | Format / Validation Rules | Purpose & Behavior |
|---|---|---|---|---|
| `RESEND_API_KEY` | **Yes** | **YES** | `re_[A-Za-z0-9_]+` | Resend production API key for transactional emails. |
| `EMAIL_FROM` | Yes | No | RFC 5322 format | Sender header (e.g. `THE HIDDEN LABEL <orders@thehiddenlabel.com>`). |
| `OTP_DEV_ECHO` | Yes | No | Must be `"false"` in production | Enforced by `env-guard.ts`. If `"true"`, startup halts. |
| `GEMINI_API_KEY` | No | **YES** | Google AI Studio / Vertex key | Powers styling concierge and fit studio AI recommendations. |

### E. Commercial & Resale Policies
| Variable Name | Required? | Secret? | Format / Validation Rules | Purpose & Behavior |
|---|---|---|---|---|
| `CONSIGNMENT_COMMISSION_RATE`| Yes | No | Decimal (e.g. `0.12` for 12%) | Official platform fee deducted from resale consignor payouts. |

---

## 4. Customer Storefront Variables (`apps/storefront/.env.production`)

Client-exposed variables are prefixed with `NEXT_PUBLIC_` and are inlined into the client JavaScript bundle at build time:

| Variable Name | Client Exposed? | Format / Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `"production"` | Next.js production runtime. |
| `PORT` | No | `3000` | Local port bound by Next.js container. |
| `MEDUSA_URL` | No | `http://backend:9000` | Internal Docker network URL for server-side fetches. |
| `NEXT_PUBLIC_SITE_URL` | **YES** | `https://thehiddenlabel.com` | Canonical site URL for metadata and OpenGraph. |
| `NEXT_PUBLIC_MEDUSA_URL`| **YES** | `https://api.thehiddenlabel.com` | Public backend URL for client-side API calls. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`| **YES**| `rzp_live_...` | Public Razorpay key consumed by `checkout.js` modal. |
| `NEXT_PUBLIC_FEATURE_BIDDING`| **YES** | `"false"` | Gates consumer bidding. Defaults to `"false"` (Fixed-Price). |
| `NEXT_PUBLIC_CONSIGNMENT_COMMISSION_RATE`| **YES** | `0.12` | Displays estimated payout calculations to consignors. |

---

## 5. Admin Console Variables (`apps/admin/.env.production`)

| Variable Name | Client Exposed? | Format / Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `"production"` | Next.js production runtime. |
| `PORT` | No | `7001` | Local port bound by Admin container. |
| `MEDUSA_URL` | No | `http://backend:9000` | Internal Docker network URL for server-side admin fetches. |
| `NEXT_PUBLIC_MEDUSA_URL` | **YES** | `https://api.thehiddenlabel.com` | Public backend URL for browser authentication redirects. |
| `ADMIN_SESSION_SECRET` | No | 32-byte hex string | Encrypts admin console session cookies. |

---

## 6. Secret Generation Protocol

Execute the following commands on a secure workstation to generate cryptographic keys for production:

```bash
# Generate MEDUSA_JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate MEDUSA_COOKIE_SECRET (must be unique)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SHIPROCKET_WEBHOOK_TOKEN
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Storage Security
- Never store plain text production credentials in version control.
- On the host server, restrict environment file permissions immediately:
  ```bash
  chmod 600 apps/*/.env.production
  ```
