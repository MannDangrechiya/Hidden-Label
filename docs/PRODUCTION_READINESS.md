# PRODUCTION READINESS — The Hidden Label

**Date:** 23 November 2026
**Verdict:** **Not production-ready.** The source is buildable and the local system runs, but there is no deployment, no production configuration, no live payment/shipping/email verification, incomplete statutory data, and a storefront that is `noindex` and broken on mobile.

---

## 1. Twelve-point status

| # | Question | Status | Evidence |
|---|---|---|---|
| 1 | Source buildable? | ✅ Yes | typecheck, lint, 207 tests, storefront + admin builds; CI run #29 green |
| 2 | Database operational? | ✅ Local only | PostgreSQL 18.6, 187 tables, seeded |
| 3 | Migrations current? | ✅ Local | 12 project migrations applied; queries succeed |
| 4 | Backend operational? | ✅ Local | `:9000` health OK |
| 5 | Admin accessible? | ✅ Local (auth required) | `:7001` → `/login` |
| 6 | Storefront accessible? | ✅ Local | `:3000`, backend proxy healthy |
| 7 | External services configured? | ❌ No | No Razorpay, Shiprocket, Resend, MSG91, Gemini, S3 credentials |
| 8 | Production secrets configured? | ❌ No | `.env.production` has 7 keys, 2 `PROD_` placeholders |
| 9 | Deployment configured? | 🟡 Partial | Docker/nginx/Dockerfiles/guide; no CD, no host, no IaC |
| 10 | Live domain operational? | ❌ No | DNS resolves, HTTPS times out |
| 11 | HTTPS/backups/monitoring? | 🟡 Partial | nginx TLS config; backup scripts manual; no monitoring |
| 12 | Production transaction verified? | ❌ No | No captured prepaid end-to-end order |

---

## 2. Configuration gaps

### Required before boot (env guard will refuse otherwise)
- `DATABASE_URL` with a strong password, SSL settings.
- `REDIS_URL` (production cannot use fake Redis/Local Event Bus).
- `MEDUSA_JWT_SECRET`, `MEDUSA_COOKIE_SECRET` — random ≥ 32 chars, distinct.
- `STOREFRONT_ORIGIN`, `ADMIN_ORIGIN` — HTTPS only.
- `OTP_DEV_ECHO` must not be `true`.
- No `rzp_test_` keys in production; no `rzp_live_` keys in staging.

### Business/statutory (blocking invoices and consumer-law compliance)
- `BUSINESS_GSTIN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_CIN`, `BUSINESS_ADDRESS`, state code/name.
- Grievance officer name, email, phone, address, hours.
- Support email and phone (currently a seeded placeholder number).
- Final policy copy: shipping, returns, privacy, terms, cancellation.
- HSN mapping and country-of-origin per product.

### Integrations
- Razorpay live key id/secret + webhook secret; webhook URL registered to the production domain.
- Shiprocket email/password, webhook token, pickup location; courier/serviceability settings.
- Resend API key + verified sending domain.
- MSG91 (or Twilio) key, DLT-approved OTP template, sender ID; WhatsApp templates if used.
- S3/R2 credentials + public base URL (product media).
- Optional: Gemini key (only if AI layer is approved).

### Application
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` in storefront.
- `NEXT_PUBLIC_RETURN_WINDOW_DAYS` matching backend.
- `MEDUSA_PUBLISHABLE_KEY` injected into storefront/admin as appropriate.
- Real `NEXT_PUBLIC_SITE_URL` for canonical/OG/redirects.

---

## 3. Hosting and topology

**Reference topology already supported by the repo:**

```
Internet → nginx (TLS, HSTS, CSP, rate limits)
   ├── storefront  (Next.js, :3000)
   ├── admin       (Next.js, :7001, restricted by IP/VPN if possible)
   └── api         (:9000)  → PostgreSQL (managed or self-hosted) + Redis
```

Options:
- **Docker Compose on a single VPS** (fastest, matches `docker-compose.prod.yml`). Needs host hardening, automated backups, log shipping.
- **Managed Postgres + container host** (e.g. a Node/PaaS provider for three services). Prefer managed DB for backups/failover.
- **Vercel/Cloudflare for Next apps + separate backend host**: workable, but admin and storefront need the backend origin and webhooks must be public.

Decisions required: provider, region (`ap-south-1`/India for latency and DPDP posture), domain/DNS ownership, TLS automation, admin access restriction.

---

## 4. Security checklist

| Control | State | Action |
|---|---|---|
| TLS/HSTS | Config present | Deploy, verify certificate renewal |
| CSP | Present in both apps | Test Razorpay checkout and Next scripts after deploy |
| Admin RBAC | Working | Add MFA, session list/revocation |
| Secrets management | Local env files only | Use host secret store; no `.env` on disk in prod |
| Rate limiting | Redis-backed | Ensure Redis present; monitor 429s |
| CSRF | Next server actions | Verify SameSite/Secure cookies; consider explicit origin checks |
| Upload security | Size/type guard | Move to object storage; scan/limit public access |
| Webhooks | Signature verified | Register URLs, monitor failures, replay safely |
| Dependency audit | 6 moderate | Patch before launch; add Dependabot/Renovate |
| Logging/PII | Basic | Structured logs, redaction, retention policy |
| Backups | Scripts only | Schedule daily + PITR; run a restore drill |
| Monitoring | None | Uptime, error tracking (Sentry), DB metrics, queue lag, alert routing |
| Admin exposure | Same public internet | Restrict by IP allowlist or SSO if possible |

---

## 5. Launch gates (must all be true)

1. Scope of record approved; resale/AI hidden everywhere and server-gated.
2. Storefront passes a mobile acceptance test at 360–414 px with no horizontal scroll.
3. Razorpay **test** payment completes end-to-end; then a **live ₹1** payment is made and refunded.
4. Shiprocket test shipment creates an AWB and tracking updates reach the order page.
5. Invoice renders with a valid GSTIN and correct tax split; credit note verified.
6. Email/SMS notifications delivered to a real inbox/phone; OTP works with a real provider.
7. Legal pages and grievance details published; declarations complete on all live products.
8. Production env guard passes; secrets stored in the host; no dev defaults.
9. Backups scheduled and a restore has been performed successfully.
10. Monitoring and alerting live; someone is on call for the first week.
11. SEO: robots/sitemap/canonicals/OG, analytics with consent.
12. Data cleaned: synthetic customers/orders removed or marked; resale demo data left inert.

---

## 6. Post-launch operations (first 30 days)

- Daily: failed payments, failed shipments, failed emails, refund queue, low stock, support SLA.
- Weekly: revenue vs. plan, conversion by device, return rate by brand, payment success rate.
- Monthly: GST filing pack, credit-note reconciliation, backup restore spot check, dependency updates.
- Incident runbooks: payment captured without order; courier outage; email provider outage; database failover; credential rotation.

---

## 7. Honest statement of current capability

The team can **demo** a sophisticated commerce platform today and can **build** the remaining pieces quickly because the domain model is real. The business cannot **trade** on it yet: no customer can pay, no parcel can ship with a real AWB, no legal invoice can be issued, and no one can find the site on a phone or in search.
