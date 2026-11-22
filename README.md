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

### 1. Resale & Bidding Marketplace
* **Secondary Market & Consignment:** Verified resale listings for authenticated sneakers and luxury streetwear.
* **Condition Grading:** Standardized inspection criteria (New With Box, Excellent, Good) with serial numbers.
* **Live Inspection Viewer:** Dedicated customer verification interface (`/inspection/[serial]` and `/verify/[serial]`) showing high-res macro photography and authentication certificates.
* **Orderbook Bidding:** Real-time bid and ask placement with seller/buyer matching mechanisms.

### 2. Bespoke Tailoring & Fit Studio
* **Precision Metric Sizing:** Millimeter-based foot length and silhouette volumetric analysis across key footwear silhouettes (Air Jordan 1, Samba OG, Dunk Low, 990v6).
* **Custom Measurement Profiles:** Bespoke sizing drawers on the storefront capturing tailored apparel dimensions.
* **Fit Rules Engine:** Admin-configurable sizing rule overrides per brand and silhouette.

### 3. Indian Payments Stack
* **Razorpay Gateway:** Native support for Credit/Debit Cards, NetBanking, and UPI Intent & QR flows.
* **Hardened Cash on Delivery (COD):** Server-side risk validation, order amount ceilings, pincode eligibility checks, and tamper-resistant state transitions.
* **Idempotency & Webhooks:** Cryptographically verified webhook handling with replay protection and automatic refund reconciliation.

### 4. Logistics & Shipping (Shiprocket)
* **Automated Dispatch:** Real-time courier serviceability checks, AWB assignment, and shipping label generation.
* **Multi-Carrier Fulfillment:** Routing between Indian express logistics providers via Shiprocket APIs.
* **Warehouse & Store Pickup:** Omnichannel pickup support with return pickup scheduling and restock workflows.

### 5. Indian GST Tax & Compliance
* **Automated Slab Calculation:** Dynamic 12% (footwear < ₹1,000) and 18% (footwear ≥ ₹1,000 / apparel) GST assignment with HSN code classification.
* **Tax Invoicing:** Compliant B2C and B2B invoices displaying CGST + SGST (intra-state) or IGST (inter-state) breakdowns.
* **Credit Notes & Reporting:** Automated credit note generation for returns/cancellations and monthly GSTR-ready CSV/JSON exports in Admin.

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

### Docker Orchestration

For production environments, use `docker-compose.prod.yml`:

```bash
# Validate production environment configuration
cp .env.production.example .env.production
# Edit .env.production with live credentials

# Build and start the production stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
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
