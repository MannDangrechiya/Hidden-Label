# THE HIDDEN LABEL — Multi-Brand E-Commerce & Resale Platform

Centralized multi-brand luxury streetwear, sneaker resale, and bespoke tailoring platform built for the Indian market and omnichannel operations.

The platform combines a **Medusa 2.22 commerce backend**, a high-performance **Next.js 16 customer storefront**, and a dedicated **Next.js 16 operations admin dashboard**, integrated with the complete Indian commerce stack (Razorpay, Shiprocket, GST invoicing, and OTP verification).

---

## Architecture Overview

```
                               ┌─────────────────────────────┐
                               │     Customer Storefront     │
                               │    (Next.js 16 / :3000)     │
                               └──────────────┬──────────────┘
                                              │ REST / JSON
                                              ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐        ┌─────────────────────────────┐
│       Operations Admin      │------->│        Medusa Engine        │<-------│    Shiprocket Logistics     │
│    (Next.js 16 / :7001)     │        │     (Node.js / :9000)       │        │     (Shipping / Labels)     │
└─────────────────────────────┘        └──────────────┬──────────────┘        └─────────────────────────────┘
                                              │       │
                                              ▼       ▼
                               ┌───────────────────┐ ┌───────────────────┐
                               │   PostgreSQL 18   │ │   Razorpay API    │
                               │      (:5437)      │ │  (UPI/Cards/COD)  │
                               └───────────────────┘ └───────────────────┘
```

### Monorepo Structure

```
├── apps/
│   ├── backend/          # Medusa 2.22.7 commerce engine + custom modules & workflows
│   ├── admin/            # Next.js 16 operations dashboard (orders, inventory, resale, GST)
│   └── storefront/       # Next.js 16 luxury customer storefront (catalog, bespoke, resale)
├── packages/
│   ├── shared/           # Money & INR formatting, GST slab calculation, Zod schemas, types
│   ├── ui/               # Brutalist luxury design system component library (0px radius)
│   └── config/           # Shared tooling, TypeScript, and ESLint configurations
├── deploy/
│   └── nginx/            # Production reverse proxy config, SSL termination, and security headers
├── docs/                 # Core architecture blueprints, state machines, and operational guides
├── scripts/              # Database management (dev-db.mjs), test fixture cleanup, backups
├── docker-compose.yml    # Local containerized infrastructure (Postgres 18 & Redis 7)
└── docker-compose.prod.yml # Production multi-service orchestration with resource limits
```

---

## Core Capabilities

### 1. Luxury Multi-Brand Retail Vault
* **Curated Catalog:** Multi-brand luxury apparel, footwear, and accessories with size-specific inventory tracking.
* **Instant Stock & Restock Clarity:** Clear real-time stock feedback, low-stock indicators (≤ 3 units), and atelier restock enquiry prompts for out-of-stock sizes.
* **Pincode Delivery Check:** Live 6-digit Indian pincode lookup on product pages with estimated dispatch times (2–4 days) and city/state serviceability.

### 2. Bespoke Made-to-Measure Atelier
* **Custom Measurement Profiles:** Interactive made-to-measure drawer capturing body measurements in inches (chest, waist, shoulder, arm length, inseam) and fit preferences (slim, regular, relaxed).
* **Master Tailor Pipeline:** Dedicated Admin workflow tracking custom pieces through 5 verified atelier stages: *Measurements Verified → Fabric Cutting → Stitching → QC Passed → Ready for Pickup / Dispatched*.
* **Statutory Non-Returnable Policy:** Clear consumer notices and programmatic enforcement ensuring custom garments cut to client body measurements cannot be cancelled or returned once cutting commences, with 14-day boutique alterations included.

### 3. Prepaid Indian Payments (UPI & Cards)
* **Razorpay Gateway:** Native checkout supporting Instant UPI (Intent & QR) and Credit/Debit Cards.
* **Prepaid Only:** Clean digital payment architecture with zero Cash-on-Delivery (COD) risk or complex RTO verification hurdles.
* **Idempotency & Cryptographic Webhooks:** Verified Razorpay webhook signature validation with deduplication and automated payment state reconciliation.

### 4. Logistics & Shipping (Shiprocket)
* **Automated Dispatch:** Express domestic logistics integration with automated courier serviceability, AWB assignment, and shipping label generation.
* **Tracking & Reverse RMA:** Granular milestone tracking for customers and automated reverse pickup scheduling for eligible unworn returns.

### 5. Indian GST Tax & Legal Compliance
* **Automated Slab Calculation:** Dynamic 12% / 18% GST calculation with automatic HSN code classification.
* **B2C GST Invoices:** Compliant tax invoices displaying Gujarat GSTIN, optional CIN, seller address, customer place of supply, and intra-state (CGST + SGST) vs. inter-state (IGST) breakdowns.
* **Grievance Redressal:** Statutory Grievance Officer channel operating under the Consumer Protection (E-Commerce) Rules, 2020 (48h acknowledgment, 30-day resolution).

### 6. Resale & Consignment Infrastructure (Optional / Gated)
* **Turnkey Resale Engine:** Secondary market orderbook, consignment listing, and 360° inspection viewer infrastructure are fully built and tested.
* **Disabled by Default:** Controlled cleanly via `NEXT_PUBLIC_ENABLE_RESALE=false` so customers and staff remain focused purely on Retail and Bespoke operations until owner activation.

---

## Getting Started (Local Development)

### Prerequisites
* **Node.js:** `>= 22.22.0`
* **pnpm:** `10.32.1`
* **Operating System:** Windows, macOS, or Linux

### 1. Clone & Install Dependencies

```bash
git clone <repository-url>
cd "The Hidden Label"
pnpm install
```

### 2. Configure Environment Variables

Copy the provided example files across the workspace:

```bash
# Root
cp .env.example .env

# Apps
cp apps/backend/.env.example apps/backend/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/storefront/.env.example apps/storefront/.env.local
```

### 3. Start Database & Seed

The project includes an embedded PostgreSQL 18 binary runner that requires no system-level PostgreSQL or Docker setup. Alternatively, Docker Compose can be used.

```bash
# Option A: Project-local PostgreSQL runner (no Docker required)
pnpm db:start

# Option B: Docker Compose
docker compose up -d

# Check database status
pnpm db:status
```

Run schema migrations and initialize baseline seed data:

```bash
pnpm db:migrate              # Applies Medusa migrations (150+ tables)
pnpm db:seed                 # Seeds default India region, INR currency, sales channel, and admin user
pnpm db:setup-tax            # Initializes Indian GST tax rates and HSN configurations
pnpm db:setup-payments       # Configures Razorpay and manual payment providers
```

### 4. Run Development Servers

Run services in separate terminals:

```bash
# Terminal 1: Medusa Commerce Backend (:9000)
pnpm dev:backend

# Terminal 2: Operations Admin Dashboard (:7001)
pnpm dev:admin

# Terminal 3: Customer Storefront (:3000)
pnpm dev:storefront
```

### Service Ports Reference

| Service | Port | Description |
|---|---|---|
| **Customer Storefront** | `3000` | Next.js 16 customer web application |
| **Operations Admin** | `7001` | Next.js 16 staff management dashboard |
| **Commerce Backend** | `9000` | Medusa 2.22 REST & Admin API |
| **PostgreSQL Database** | `5437` | PostgreSQL 18 relational store |
| **Redis Cache** | `6380` | Redis 7 event queue & cache (Docker mode) |

---

## Production & Staging Deployment

### Staging Deployment Guide (Step-by-Step for Mann)

#### Option A: Docker Compose (Isolated Container Staging)
```bash
# 1. Prepare environment configuration from templates
cp .env.production.example .env.production
cp apps/backend/.env.production.example apps/backend/.env.production
cp apps/admin/.env.production.example apps/admin/.env.production
cp apps/storefront/.env.production.example apps/storefront/.env.production

# 2. Add staging/live secrets in the .env.production files:
#    - PostgreSQL password & Redis secret
#    - Razorpay keys (RAZORPAY_KEY_ID / SECRET)
#    - Shiprocket credentials (SHIPROCKET_EMAIL / PASSWORD)
#    - Business GSTIN, address, and Grievance Officer details

# 3. Build and launch all application containers
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 4. Initialize database schema & baseline data
docker compose -f docker-compose.prod.yml exec backend pnpm db:migrate
docker compose -f docker-compose.prod.yml exec backend pnpm db:seed
```

#### Option B: Standalone Node.js & PM2 Staging
```bash
# 1. Install workspace dependencies
pnpm install --frozen-lockfile

# 2. Run migrations and initialize Indian tax/payment configurations
pnpm db:migrate
pnpm db:seed
pnpm db:setup-tax
pnpm db:setup-payments

# 3. Compile optimized production bundles
pnpm --filter @thl/backend build
pnpm --filter @thl/admin build
pnpm --filter @thl/storefront build

# 4. Run application instances:
#    - Backend:    apps/backend     -> pnpm start (port 9000)
#    - Admin:      apps/admin       -> pnpm start (port 7001)
#    - Storefront: apps/storefront  -> pnpm start (port 3000)
```

### Reverse Proxy & Security

The `deploy/nginx/` folder provides a hardened Nginx configuration:
* TLS 1.3 termination with strict SSL cipher suites.
* HSTS (HTTP Strict Transport Security) enabled.
* Content Security Policy (CSP) compatible with Razorpay hosted checkouts and Next.js bootstrap.
* Rate limiting for sensitive authentication and payment callback endpoints.

For step-by-step production setup, refer to [`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/PRODUCTION_DEPLOYMENT_GUIDE.md).

---

## Verification & Testing

Run the automated test and verification suite:

```bash
# Typecheck all workspace packages
pnpm typecheck

# Code quality and style linting
pnpm lint

# Unit & component tests
pnpm test

# Database integration tests (requires active Postgres)
pnpm test:integration

# Test individual app production builds
pnpm --filter @thl/backend build
pnpm --filter @thl/admin build
pnpm --filter @thl/storefront build
```

---

## Documentation Index

Core specifications and guides located in [`docs/`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/):

* [`docs/PROJECT_PLAN.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/PROJECT_PLAN.md) — Scope, architecture, milestones, and decisions register.
* [`docs/OMNICHANNEL_MASTER_ARCHITECTURE.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/OMNICHANNEL_MASTER_ARCHITECTURE.md) — Complete digital and physical retail architecture.
* [`docs/DESIGN_TOKENS.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/DESIGN_TOKENS.md) — Brutalist design tokens, typography, and styling rules.
* [`docs/ORDER_STATE_MACHINE.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/ORDER_STATE_MACHINE.md) — Order and payment lifecycle state transitions and invariants.
* [`docs/API_PLAN.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/API_PLAN.md) — REST API contracts, auth, error handling, and idempotency.
* [`docs/DATABASE_PLAN.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/DATABASE_PLAN.md) — Database schema, extensions, and migration strategy.
* [`docs/INTEGRATIONS.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/INTEGRATIONS.md) — Razorpay, Shiprocket, Resend, and Fast2SMS integration guides.
* [`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/PRODUCTION_DEPLOYMENT_GUIDE.md) — Operations runbook, server provisioning, and maintenance.
* [`docs/QA_PLAN.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/QA_PLAN.md) — Test matrix, security requirements, and acceptance criteria.
* [`docs/BUILD_LOG.md`](file:///c:/Users/ASUS/Documents/Hidden%20Label/docs/BUILD_LOG.md) — Engineering history and chronological delivery record.
