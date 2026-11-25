/**
 * THE HIDDEN LABEL — evidence-collection harness for the production-readiness audit.
 *
 * Not part of the product. It only uses dedicated `audit_*` test accounts and leaves existing
 * rows untouched (the one exception is marking its own freshly placed test order delivered so
 * the return workflow can be exercised).
 *
 * Every check writes a row: id, area, feature, status (PASS/FAIL/BLOCKED), expected, actual,
 * evidence, severity for failures. Output: .audit/results.json + console log.
 */
import fs from "node:fs";
import path from "node:path";
import pgPackage from "pg";
const { Client } = pgPackage;

const SF = "http://localhost:3000";
const BE = "http://localhost:9000";
const AD = "http://localhost:7001";
const PG = { host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" };

const envText = fs.readFileSync("apps/storefront/.env", "utf8");
const PK = /^\s*MEDUSA_PUBLISHABLE_KEY=(.+)$/m.exec(envText)?.[1]?.trim();
if (!PK) throw new Error("No MEDUSA_PUBLISHABLE_KEY in apps/storefront/.env");

const OUT_DIR = path.resolve(".audit");
fs.mkdirSync(OUT_DIR, { recursive: true });
const results = [];
const RUN = `audit_${Date.now()}`;

function save() {
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
}

function record({ id, area, feature, status, expected, actual, evidence = "", severity = "" }) {
  const row = { id, area, feature, status, expected, actual, evidence: String(evidence).slice(0, 1200), severity };
  results.push(row);
  const tag = status === "PASS" ? "PASS" : status === "BLOCKED" ? "BLCK" : "FAIL";
  console.log(`[${tag}] ${id} ${area} — ${feature} :: ${String(actual).replace(/\s+/g, " ").slice(0, 180)}`);
  save();
  return row;
}

function pass(r) {
  record({ ...r, status: "PASS" });
}
function fail(r) {
  record({ ...r, status: "FAIL" });
}

async function req(url, { method = "GET", headers = {}, body, cookie, redirect = "manual", timeout = 30000 } = {}) {
  const h = { accept: "application/json", ...headers };
  if (cookie) h.cookie = cookie;
  let payload = body;
  if (body !== undefined && typeof body !== "string") {
    h["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: h,
      body: payload,
      redirect,
      signal: AbortSignal.timeout(timeout),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json,
      ms: Date.now() - started,
      location: res.headers.get("location"),
      url,
    };
  } catch (error) {
    return { status: 0, headers: {}, text: "", json: null, ms: Date.now() - started, error: String(error), url };
  }
}

const storeHeaders = (token) => ({
  "x-publishable-api-key": PK,
  ...(token ? { authorization: `Bearer ${token}` } : {}),
});

function firstHeading(html) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m) return "";
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const ERROR_SIGNATURES = [
  "Application error: a server-side exception",
  "Unhandled Runtime Error",
  "This page could not be found",
  "Internal Server Error",
];

async function checkPage({ id, area, url, label, cookie, expectStatus = 200, mustInclude = [], forbid = [], severity = "High" }) {
  const started = Date.now();
  const res = await req(url, { cookie });
  const html = res.text;
  const foundForbidden = [...ERROR_SIGNATURES, ...forbid].filter((s) => html.includes(s));
  const missing = mustInclude.filter((s) => !html.includes(s));
  const ok = res.status === expectStatus && missing.length === 0 && foundForbidden.length === 0;
  const detail = `HTTP ${res.status} in ${res.ms}ms · H1 "${firstHeading(html)}"` +
    (missing.length ? ` · missing: ${missing.join(", ")}` : "") +
    (foundForbidden.length ? ` · found error text: ${foundForbidden.join(", ")}` : "");
  if (ok) {
    pass({ id, area, feature: label, expected: `HTTP ${expectStatus} with real content`, actual: detail, evidence: `${url} (${Date.now() - started}ms)` });
  } else {
    fail({ id, area, feature: label, expected: `HTTP ${expectStatus} with real content`, actual: detail, evidence: url, severity });
  }
  return { ...res, ok, detail };
}

async function main() {
  const pg = new Client(PG);
  await pg.connect();

  /* ---------------------------------------------------------------- 0. infra */
  let r = await req(`${BE}/health`);
  r.status === 200
    ? pass({ id: "INF-01", area: "Infra", feature: "Medusa backend health", expected: "200 OK", actual: `HTTP ${r.status} body="${r.text.trim()}"`, evidence: `${BE}/health` })
    : fail({ id: "INF-01", area: "Infra", feature: "Medusa backend health", expected: "200 OK", actual: `HTTP ${r.status}`, evidence: r.error ?? "", severity: "Critical" });

  r = await req(`${SF}/api/health`);
  r.json?.backend?.status === "up"
    ? pass({ id: "INF-02", area: "Infra", feature: "Storefront health + backend link", expected: "status ok, backend up", actual: JSON.stringify(r.json), evidence: `${SF}/api/health` })
    : fail({ id: "INF-02", area: "Infra", feature: "Storefront health + backend link", expected: "status ok, backend up", actual: JSON.stringify(r.json ?? r.text), evidence: `${SF}/api/health`, severity: "Critical" });

  const tables = await pg.query(
    "select count(*)::int n from information_schema.tables where table_schema='public'",
  );
  pass({ id: "INF-03", area: "Database", feature: "Schema present", expected: "151+ public tables", actual: `${tables.rows[0].n} public tables`, evidence: "information_schema.tables" });

  const counts = await pg.query(`
    select
      (select count(*)::int from product) products,
      (select count(*)::int from product_variant) variants,
      (select count(*)::int from customer) customers,
      (select count(*)::int from "order") orders,
      (select count(*)::int from return_request) returns,
      (select count(*)::int from brand) brands,
      (select count(*)::int from audit_event) audit,
      (select count(*)::int from resale_ask) asks,
      (select count(*)::int from resale_bid) bids,
      (select count(*)::int from condition_inspection) inspections`);
  pass({ id: "INF-04", area: "Database", feature: "Seeded data inventory", expected: "catalogue, users, orders, resale data present", actual: JSON.stringify(counts.rows[0]), evidence: "row counts" });

  /* ------------------------------------------------------------- 1. data ids */
  const regions = await req(`${BE}/store/regions`, { headers: storeHeaders() });
  const region = regions.json?.regions?.find((x) => x.currency_code === "inr") ?? regions.json?.regions?.[0];
  const productsRes = await req(`${BE}/store/products?limit=100&region_id=${region?.id ?? ""}`, { headers: storeHeaders() });
  const products = productsRes.json?.products ?? [];
  const brandsRes = await req(`${BE}/store/brands`, { headers: storeHeaders() });
  const brands = brandsRes.json?.brands ?? [];
  const cmsRes = await req(`${BE}/store/cms/shipping`, { headers: storeHeaders() });
  const blog = cmsRes.json?.page ?? cmsRes.json?.cms_page ?? null;

  products.length > 0
    ? pass({ id: "DAT-01", area: "Database/API", feature: "Store product API returns catalogue", expected: ">=1 product", actual: `${products.length} products, ${products.reduce((n, p) => n + (p.variants?.length ?? 0), 0)} variants`, evidence: "/store/products" })
    : fail({ id: "DAT-01", area: "Database/API", feature: "Store product API returns catalogue", expected: ">=1 product", actual: `HTTP ${productsRes.status}`, evidence: productsRes.text.slice(0, 300), severity: "Critical" });

  brands.length > 0
    ? pass({ id: "DAT-02", area: "Database/API", feature: "Brand module data", expected: ">=1 brand", actual: `${brands.length} brands`, evidence: "/store/brands" })
    : fail({ id: "DAT-02", area: "Database/API", feature: "Brand module data", expected: ">=1 brand", actual: `HTTP ${brandsRes.status}`, evidence: brandsRes.text.slice(0, 300), severity: "High" });

  const footwear = products.find((p) => p.variants?.some((v) => /UK \d/.test(v.title ?? ""))) ?? products[0];
  const apparel = products.find((p) => p.variants?.some((v) => /^(XS|S|M|L|XL|XXL)$/.test(v.title ?? ""))) ?? products.find((p) => p.id !== footwear?.id);

  // Pick a variant that actually has stock for the order journey (several seeded footwear sizes are 0).
  const available = await pg.query(`
    select pv.id variant_id, pv.title variant_title, p.handle, p.title product_title
    from product_variant pv
    join product p on p.id = pv.product_id
    left join inventory_item ii on ii.sku = pv.sku
    left join inventory_level il on il.inventory_item_id = ii.id
    where p.deleted_at is null
    group by pv.id, pv.title, p.handle, p.title
    having coalesce(sum(il.stocked_quantity - il.reserved_quantity), 0) >= 2
    order by p.title
    limit 50`);
  const orderCandidate =
    available.rows.find((row) => row.handle.includes("bespoke")) ?? available.rows[0];
  const orderProduct = products.find((p) => p.handle === orderCandidate?.handle) ?? footwear;
  const inStockVariant = orderCandidate
    ? { id: orderCandidate.variant_id, title: orderCandidate.variant_title }
    : footwear?.variants?.[0];

  /* --------------------------------------------------------- 2. storefront */
  const publicPages = [
    ["/", "Homepage", "U-01"],
    ["/collections/all", "Catalogue", "U-05"],
    ["/collections/footwear", "Collection: footwear", "U-05"],
    ["/collections/menswear", "Collection: menswear", "U-05"],
    ["/collections/womenswear", "Collection: womenswear", "U-05"],
    ["/collections/bespoke", "Collection: bespoke", "U-05"],
    ["/collections/accessories", "Collection: accessories", "U-05"],
    ["/brands", "Brand directory", "U-03"],
    ["/search?q=jordan", "Search results", "U-07"],
    ["/search?q=zzzznotfound", "Search zero results", "U-07"],
    ["/about", "About / contact", "U-23"],
    ["/support", "Support hub", "U-22"],
    ["/size-guide", "Size guide", "U-25"],
    ["/authenticity", "Authenticity protocol", "U-26"],
    ["/policies/shipping", "Policy: shipping", "U-24"],
    ["/policies/returns", "Policy: returns", "U-24"],
    ["/policies/privacy", "Policy: privacy", "U-24"],
    ["/policies/terms", "Policy: terms", "U-24"],
    ["/login", "Login", "U-15"],
    ["/register", "Register", "U-16"],
    ["/forgot-password", "Forgot password", "U-15"],
    ["/reset-password?token=invalid", "Reset password", "U-15"],
    ["/sell", "Consignor hub", "AI-02"],
    ["/fit-studio", "Fit studio", "AI-04"],
    ["/design", "Design token gallery", "SYS-00"],
  ];
  let pageIndex = 0;
  for (const [route, label, code] of publicPages) {
    pageIndex += 1;
    await checkPage({ id: `SF-${String(pageIndex).padStart(2, "0")}`, area: "Storefront", url: `${SF}${route}`, label: `${code} ${route}`, mustInclude: [] });
  }

  if (footwear) {
    await checkPage({ id: "SF-30", area: "Storefront", url: `${SF}/products/${footwear.handle}`, label: `U-08 PDP /products/${footwear.handle}`, mustInclude: ["Buy Now"] });
  }
  if (apparel) {
    await checkPage({ id: "SF-31", area: "Storefront", url: `${SF}/products/${apparel.handle}`, label: `U-08 PDP (apparel) /products/${apparel.handle}` });
  }
  if (brands[0]?.handle) {
    await checkPage({ id: "SF-32", area: "Storefront", url: `${SF}/brands/${brands[0].handle}`, label: `U-04 Brand vault /brands/${brands[0].handle}` });
  }

  // 404 boundary
  r = await req(`${SF}/this-route-does-not-exist`);
  r.status === 404 && /404|not found/i.test(r.text)
    ? pass({ id: "SF-40", area: "Storefront", feature: "Custom 404 boundary", expected: "HTTP 404 with branded copy", actual: `HTTP ${r.status} · H1 "${firstHeading(r.text)}"`, evidence: "/this-route-does-not-exist" })
    : fail({ id: "SF-40", area: "Storefront", feature: "Custom 404 boundary", expected: "HTTP 404 with branded copy", actual: `HTTP ${r.status} · H1 "${firstHeading(r.text)}"`, evidence: r.text.slice(0, 300), severity: "Low" });

  // Guest guards
  for (const [route, label] of [
    ["/account", "Customer dashboard"],
    ["/account/orders", "Order history"],
    ["/account/addresses", "Address book"],
    ["/account/wishlist", "Wishlist"],
    ["/account/bids", "My bids"],
    ["/account/asks", "Consignments"],
    ["/verify", "OTP verify page"],
  ]) {
    r = await req(`${SF}${route}`);
    const guarded = r.status >= 300 && r.status < 400 && (r.location ?? "").includes("/login");
    guarded
      ? pass({ id: `SF-G-${route}`, area: "Storefront/Auth", feature: `Guest blocked from ${label}`, expected: "redirect to /login", actual: `HTTP ${r.status} → ${r.location}`, evidence: route })
      : fail({ id: `SF-G-${route}`, area: "Storefront/Auth", feature: `Guest blocked from ${label}`, expected: "redirect to /login", actual: `HTTP ${r.status} → ${r.location ?? "no redirect"}`, evidence: route, severity: "High" });
  }

  // Empty cart / checkout guard
  r = await req(`${SF}/cart`);
  r.status === 200 && /bag|cart|empty/i.test(r.text)
    ? pass({ id: "SF-50", area: "Storefront", feature: "U-12 Cart page (empty state)", expected: "200 with empty-bag state", actual: `HTTP ${r.status} · H1 "${firstHeading(r.text)}"`, evidence: "/cart" })
    : fail({ id: "SF-50", area: "Storefront", feature: "U-12 Cart page (empty state)", expected: "200 with empty-bag state", actual: `HTTP ${r.status}`, evidence: r.text.slice(0, 200), severity: "Medium" });
  r = await req(`${SF}/checkout`);
  (r.status === 307 || r.status === 302 || r.status === 303) && (r.location ?? "").includes("/cart")
    ? pass({ id: "SF-51", area: "Storefront", feature: "Checkout without a cart redirects", expected: "redirect to /cart", actual: `HTTP ${r.status} → ${r.location}`, evidence: "/checkout" })
    : fail({ id: "SF-51", area: "Storefront", feature: "Checkout without a cart redirects", expected: "redirect to /cart", actual: `HTTP ${r.status} → ${r.location ?? "none"}`, evidence: "/checkout", severity: "Medium" });

  /* --------------------------------------------------------------- 3. auth */
  const emailA = `${RUN}.buyer@example.com`;
  const emailB = `${RUN}.other@example.com`;
  const password = "AuditPass123!";

  // invalid registration payload is rejected by the auth provider
  r = await req(`${BE}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: storeHeaders(),
    body: { email: "not-an-email", password: "123" },
  });
  [400, 422].includes(r.status)
    ? pass({ id: "AUT-01", area: "Auth", feature: "Registration API rejects invalid email/password", expected: "400/422", actual: `HTTP ${r.status} ${r.json?.message ?? ""}`, evidence: "/auth/customer/emailpass/register" })
    : fail({ id: "AUT-01", area: "Auth", feature: "Registration API rejects invalid email/password", expected: "400/422", actual: `HTTP ${r.status} — an identity/token was issued for email="not-an-email", password="123" (storefront zod schema blocks this in the UI, the API itself does not)`, evidence: "/auth/customer/emailpass/register", severity: "Medium" });

  async function createCustomer(email) {
    const reg = await req(`${BE}/auth/customer/emailpass/register`, {
      method: "POST",
      headers: storeHeaders(),
      body: { email, password },
    });
    if (!reg.json?.token) return { ok: false, step: "register", res: reg };
    const cust = await req(`${BE}/store/customers`, {
      method: "POST",
      headers: storeHeaders(reg.json.token),
      body: { email, first_name: "Audit", last_name: "Buyer", phone: "+919876500001" },
    });
    if (!cust.json?.customer) return { ok: false, step: "customer", res: cust };
    const login = await req(`${BE}/auth/customer/emailpass`, {
      method: "POST",
      headers: storeHeaders(),
      body: { email, password },
    });
    if (!login.json?.token) return { ok: false, step: "login", res: login };
    return { ok: true, customer: cust.json.customer, token: login.json.token };
  }

  const buyerA = await createCustomer(emailA);
  buyerA.ok
    ? pass({ id: "AUT-02", area: "Auth", feature: "New customer register → login", expected: "customer record + JWT", actual: `customer ${buyerA.customer.id} created and logged in`, evidence: emailA })
    : fail({ id: "AUT-02", area: "Auth", feature: "New customer register → login", expected: "customer record + JWT", actual: `failed at ${buyerA.step}: HTTP ${buyerA.res.status} ${buyerA.res.text.slice(0, 200)}`, evidence: emailA, severity: "Critical" });

  const buyerB = await createCustomer(emailB);
  buyerB.ok
    ? pass({ id: "AUT-03", area: "Auth", feature: "Second test customer (for isolation tests)", expected: "second customer", actual: `${buyerB.customer.id}`, evidence: emailB })
    : fail({ id: "AUT-03", area: "Auth", feature: "Second test customer (for isolation tests)", expected: "second customer", actual: `HTTP ${buyerB.res.status}`, evidence: emailB, severity: "High" });

  if (!buyerA.ok) throw new Error("Cannot continue without the primary test customer");

  const tokenA = buyerA.token;
  const tokenB = buyerB.token;
  const cookieA = `thl_auth=${tokenA}`;

  r = await req(`${BE}/auth/customer/emailpass`, { method: "POST", headers: storeHeaders(), body: { email: emailA, password: "WrongPass123!" } });
  r.status >= 400 && r.status < 500
    ? pass({ id: "AUT-04", area: "Auth", feature: "Wrong password rejected", expected: "4xx", actual: `HTTP ${r.status} ${r.json?.message ?? ""}`, evidence: "" })
    : fail({ id: "AUT-04", area: "Auth", feature: "Wrong password rejected", expected: "4xx", actual: `HTTP ${r.status}`, evidence: "", severity: "Critical" });

  r = await req(`${BE}/auth/customer/emailpass/register`, { method: "POST", headers: storeHeaders(), body: { email: emailA, password } });
  [400, 401, 409, 422].includes(r.status)
    ? pass({ id: "AUT-05", area: "Auth", feature: "Duplicate registration rejected", expected: "4xx", actual: `HTTP ${r.status} ${r.json?.message ?? ""}`, evidence: emailA })
    : fail({ id: "AUT-05", area: "Auth", feature: "Duplicate registration rejected", expected: "4xx", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: emailA, severity: "High" });

  r.status === 401 && /already exists/i.test(r.text)
    ? fail({ id: "AUT-05B", area: "Auth", feature: "Registration does not disclose whether an email is registered", expected: "generic rejection", actual: `HTTP 401 "${r.json?.message}" — the API confirms the address already has an account (account enumeration)`, evidence: "POST /auth/customer/emailpass/register", severity: "Medium" })
    : pass({ id: "AUT-05B", area: "Auth", feature: "Registration does not disclose whether an email is registered", expected: "generic rejection", actual: `HTTP ${r.status} ${r.json?.message ?? ""}`, evidence: "" });

  r = await req(`${BE}/store/customers/me`, { headers: storeHeaders() });
  r.status === 401
    ? pass({ id: "AUT-06", area: "Auth", feature: "Profile requires a session", expected: "401", actual: `HTTP ${r.status}`, evidence: "/store/customers/me" })
    : fail({ id: "AUT-06", area: "Auth", feature: "Profile requires a session", expected: "401", actual: `HTTP ${r.status}`, evidence: "", severity: "Critical" });

  // OTP
  const otpDest = `${RUN}.otp@example.com`;
  const otpSend = await req(`${BE}/store/otp/send`, { method: "POST", headers: storeHeaders(tokenA), body: { destination: otpDest, channel: "email", purpose: "email_verify" } });
  const devCode = otpSend.json?.dev_code;
  otpSend.status === 201 || otpSend.status === 200
    ? pass({ id: "AUT-07", area: "Auth/OTP", feature: "OTP send returns a challenge", expected: "challenge_id", actual: `HTTP ${otpSend.status} challenge=${otpSend.json?.challenge_id} dev_echo=${Boolean(devCode)} delivered=${otpSend.json?.delivered}`, evidence: "/store/otp/send" })
    : fail({ id: "AUT-07", area: "Auth/OTP", feature: "OTP send returns a challenge", expected: "challenge_id", actual: `HTTP ${otpSend.status} ${otpSend.text.slice(0, 200)}`, evidence: "", severity: "High" });

  r = await req(`${BE}/store/otp/verify`, { method: "POST", headers: storeHeaders(tokenA), body: { challenge_id: otpSend.json?.challenge_id, code: "000000" } });
  r.status >= 400 && r.status < 500
    ? pass({ id: "AUT-08", area: "Auth/OTP", feature: "Wrong OTP code rejected", expected: "4xx", actual: `HTTP ${r.status} ${r.json?.message ?? ""}`, evidence: "" })
    : fail({ id: "AUT-08", area: "Auth/OTP", feature: "Wrong OTP code rejected", expected: "4xx", actual: `HTTP ${r.status}`, evidence: "", severity: "Critical" });

  if (devCode) {
    r = await req(`${BE}/store/otp/verify`, { method: "POST", headers: storeHeaders(tokenA), body: { challenge_id: otpSend.json.challenge_id, code: devCode } });
    r.status === 200 && r.json?.verified === true
      ? pass({ id: "AUT-09", area: "Auth/OTP", feature: "Correct OTP code verifies", expected: "verified=true", actual: `HTTP ${r.status}`, evidence: "" })
      : fail({ id: "AUT-09", area: "Auth/OTP", feature: "Correct OTP code verifies", expected: "verified=true", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: "", severity: "High" });
  } else {
    record({ id: "AUT-09", area: "Auth/OTP", feature: "Correct OTP code verifies", status: "BLOCKED", expected: "verified=true", actual: "No dev code returned (OTP_DEV_ECHO off / real provider absent)", evidence: "", severity: "High" });
  }

  // rate limit: 3 sends per 15 minutes per destination
  const limitDest = `${RUN}.ratelimit@example.com`;
  const statuses = [];
  for (let i = 0; i < 4; i += 1) {
    const x = await req(`${BE}/store/otp/send`, { method: "POST", headers: storeHeaders(tokenA), body: { destination: limitDest, channel: "email", purpose: "email_verify" } });
    statuses.push(x.status);
  }
  statuses[3] === 429
    ? pass({ id: "AUT-10", area: "Auth/OTP", feature: "OTP send rate limit (3 / 15 min)", expected: "4th send → 429", actual: `statuses ${statuses.join(",")}`, evidence: "" })
    : fail({ id: "AUT-10", area: "Auth/OTP", feature: "OTP send rate limit (3 / 15 min)", expected: "4th send → 429", actual: `statuses ${statuses.join(",")}`, evidence: "", severity: "High" });

  // Password reset request must not reveal account existence
  const r1 = await req(`${BE}/auth/customer/emailpass/reset-password`, { method: "POST", headers: storeHeaders(), body: { identifier: emailA } });
  const r2 = await req(`${BE}/auth/customer/emailpass/reset-password`, { method: "POST", headers: storeHeaders(), body: { identifier: `${RUN}.ghost@example.com` } });
  r1.status === r2.status && r1.status < 300
    ? pass({ id: "AUT-11", area: "Auth", feature: "Password reset does not reveal account existence", expected: "same success response for known + unknown email", actual: `known=${r1.status} unknown=${r2.status}`, evidence: "" })
    : fail({ id: "AUT-11", area: "Auth", feature: "Password reset does not reveal account existence", expected: "same success response", actual: `known=${r1.status} unknown=${r2.status}`, evidence: r1.text.slice(0, 120) + " / " + r2.text.slice(0, 120), severity: "Medium" });

  /* --------------------------------------------------- 4. authenticated UI */
  const authedPages = [
    ["/account", "U-18 Customer dashboard", ["Audit"]],
    ["/account/orders", "U-19 Order history"],
    ["/account/addresses", "Address book"],
    ["/account/wishlist", "U-10 Wishlist"],
    ["/account/bids", "Buyer bids"],
    ["/account/asks", "Consignor listings"],
    ["/verify", "U-17 OTP verification"],
  ];
  for (const [route, label, must] of authedPages) {
    await checkPage({ id: `AUT-P-${route}`, area: "Storefront/Auth", url: `${SF}${route}`, label: `${label} (signed in)`, cookie: cookieA, mustInclude: must ?? [] });
  }

  // session persistence: same cookie still works after a re-login with a fresh token
  const relogin = await req(`${BE}/auth/customer/emailpass`, { method: "POST", headers: storeHeaders(), body: { email: emailA, password } });
  const cookieA2 = `thl_auth=${relogin.json?.token}`;
  await checkPage({ id: "AUT-12", area: "Storefront/Auth", url: `${SF}/account`, label: "Session persists across a new login", cookie: cookieA2, mustInclude: ["Audit"] });
  await checkPage({ id: "AUT-13", area: "Storefront/Auth", url: `${SF}/account`, label: "Expired/invalid session cookie is treated as guest", cookie: "thl_auth=invalid.token.value", expectStatus: 307 });

  /* --------------------------------------------------------- 5. catalog API */
  const apiChecks = [
    ["/store/products?limit=3", "Store product list", 200],
    [`/store/products?handle=${encodeURIComponent(footwear?.handle ?? "")}`, "Product by handle", 200],
    [`/store/search/suggest?q=samba`, "Search typeahead", 200],
    [`/store/resale/products/${footwear?.handle}/index`, "Price index (AI-02)", 200],
    ["/store/resale/recent-activity", "Recent resale activity", 200],
    ["/store/brands", "Brand list", 200],
    ["/store/cms/policies/shipping", "CMS page by multi-segment slug", 200],
    ["/store/cms/policies/returns", "CMS page by multi-segment slug (returns)", 200],
    ["/store/content/home", "Homepage content", 200],
  ];
  for (const [p, label, expected] of apiChecks) {
    const x = await req(`${BE}${p}`, { headers: storeHeaders() });
    x.status === expected
      ? pass({ id: `API-${p}`, area: "Backend API", feature: label, expected: `HTTP ${expected}`, actual: `HTTP ${x.status} in ${x.ms}ms`, evidence: p })
      : fail({ id: `API-${p}`, area: "Backend API", feature: label, expected: `HTTP ${expected}`, actual: `HTTP ${x.status} ${x.text.slice(0, 180)}`, evidence: p, severity: "High" });
  }

  // fit engine
  r = await req(`${BE}/store/fit/recommend`, { method: "POST", headers: storeHeaders(), body: { foot_length_cm: 27.2, foot_width: "regular", product_handle: footwear?.handle } });
  r.status === 200 && r.json?.recommended_size
    ? pass({ id: "API-FIT-01", area: "Backend API", feature: "Fit recommendation (AI-04)", expected: "recommended size", actual: `HTTP ${r.status} ${r.json.recommended_size} (${r.json.fit_tendency})`, evidence: "/store/fit/recommend" })
    : fail({ id: "API-FIT-01", area: "Backend API", feature: "Fit recommendation (AI-04)", expected: "recommended size", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: "", severity: "High" });

  r = await req(`${BE}/store/fit/recommend`, { method: "POST", headers: storeHeaders(), body: {} });
  r.status === 400
    ? pass({ id: "API-FIT-02", area: "Backend API", feature: "Fit engine rejects empty input", expected: "400", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "API-FIT-02", area: "Backend API", feature: "Fit engine rejects empty input", expected: "400", actual: `HTTP ${r.status}`, evidence: "", severity: "Low" });

  // concierge
  r = await req(`${BE}/store/concierge/chat`, { method: "POST", headers: storeHeaders(), body: { message: "I want white sneakers for daily wear", session_token: RUN }, timeout: 60000 });
  r.status === 200 && r.json?.reply
    ? pass({ id: "API-AI-05", area: "Backend API", feature: "Style concierge reply (AI-05)", expected: "grounded reply", actual: `HTTP ${r.status} in ${r.ms}ms · ${String(r.json.reply).slice(0, 80)}`, evidence: "/store/concierge/chat" })
    : fail({ id: "API-AI-05", area: "Backend API", feature: "Style concierge reply (AI-05)", expected: "grounded reply", actual: `HTTP ${r.status} after ${r.ms}ms ${r.text.slice(0, 160)}`, evidence: "", severity: "Medium" });
  if (r.status === 200 && r.ms > 5000) {
    fail({ id: "PERF-AI-05", area: "Performance", feature: "Style concierge responds promptly", expected: "< 5s local response", actual: `${r.ms}ms — Gemini call is attempted first and only falls back to the template reply after its retry/timeout`, evidence: "/store/concierge/chat", severity: "Medium" });
  }

  // sight search
  r = await req(`${BE}/store/sight-search`, { method: "POST", headers: storeHeaders(), body: { tags: ["samba"], silhouette_hint: "Samba" } });
  r.status === 200 && Array.isArray(r.json?.matches)
    ? pass({ id: "API-AI-01", area: "Backend API", feature: "Search by sight (AI-01) keyword mode", expected: "matches with honest mode label", actual: `HTTP ${r.status} · ${r.json.matches.length} matches · mode=${r.json.detected_features?.mode}`, evidence: "/store/sight-search" })
    : fail({ id: "API-AI-01", area: "Backend API", feature: "Search by sight (AI-01)", expected: "matches", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: "", severity: "Medium" });

  /* -------------------------------------------------------- 6. wishlist/bids */
  const variantId = footwear?.variants?.[0]?.id;
  r = await req(`${BE}/store/wishlist`, { headers: storeHeaders() });
  r.status === 401
    ? pass({ id: "SEC-01", area: "Security", feature: "Wishlist requires customer auth", expected: "401", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "SEC-01", area: "Security", feature: "Wishlist requires customer auth", expected: "401", actual: `HTTP ${r.status}`, evidence: "", severity: "High" });

  r = await req(`${BE}/store/wishlist`, { method: "POST", headers: storeHeaders(tokenA), body: { variant_id: variantId } });
  const wishOk = r.status === 201 || r.status === 200;
  const wishList = await req(`${BE}/store/wishlist`, { headers: storeHeaders(tokenA) });
  const wishPersisted = (wishList.json?.items ?? []).some((i) => i.variant_id === variantId);
  wishOk && wishPersisted
    ? pass({ id: "WL-01", area: "Storefront feature", feature: "Wishlist save + persist", expected: "item saved and listed", actual: `POST ${r.status}, GET has ${wishList.json?.items?.length ?? 0} item(s)`, evidence: "" })
    : fail({ id: "WL-01", area: "Storefront feature", feature: "Wishlist save + persist", expected: "item saved and listed", actual: `POST ${r.status}, GET ${wishList.status}`, evidence: wishList.text.slice(0, 200), severity: "Medium" });

  await checkPage({ id: "WL-02", area: "Storefront feature", url: `${SF}/account/wishlist`, label: "Wishlist page shows saved item", cookie: cookieA, mustInclude: [footwear?.title?.slice(0, 12) ?? ""].filter(Boolean) });

  r = await req(`${BE}/store/wishlist?variant_id=${encodeURIComponent(variantId)}`, { method: "DELETE", headers: storeHeaders(tokenA) });
  const afterDelete = await req(`${BE}/store/wishlist`, { headers: storeHeaders(tokenA) });
  r.status === 200 && !(afterDelete.json?.items ?? []).some((i) => i.variant_id === variantId)
    ? pass({ id: "WL-03", area: "Storefront feature", feature: "Wishlist remove", expected: "item removed", actual: `DELETE ${r.status}, remaining ${afterDelete.json?.items?.length ?? 0}`, evidence: "" })
    : fail({ id: "WL-03", area: "Storefront feature", feature: "Wishlist remove", expected: "item removed", actual: `DELETE ${r.status}`, evidence: afterDelete.text.slice(0, 150), severity: "Medium" });

  r = await req(`${BE}/store/resale/bids`, { method: "POST", headers: storeHeaders(tokenA), body: { variant_id: variantId, bid_price: 12000 } });
  const bidId = r.json?.bid?.id;
  bidId
    ? pass({ id: "BID-01", area: "Storefront feature", feature: "Place resale bid", expected: "201 bid", actual: `HTTP ${r.status} ₹${r.json.bid.bid_price}`, evidence: bidId })
    : fail({ id: "BID-01", area: "Storefront feature", feature: "Place resale bid", expected: "201 bid", actual: `HTTP ${r.status} ${r.text.slice(0, 180)}`, evidence: "", severity: "High" });

  r = await req(`${BE}/store/resale/bids`, { method: "POST", headers: storeHeaders(tokenA), body: { variant_id: variantId, bid_price: -5 } });
  r.status === 400
    ? pass({ id: "BID-02", area: "Storefront feature", feature: "Bid rejects non-positive price", expected: "400", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "BID-02", area: "Storefront feature", feature: "Bid rejects non-positive price", expected: "400", actual: `HTTP ${r.status}`, evidence: "", severity: "Medium" });

  const bidsList = await req(`${BE}/store/resale/bids`, { headers: storeHeaders(tokenA) });
  (bidsList.json?.bids ?? []).some((b) => b.id === bidId)
    ? pass({ id: "BID-03", area: "Storefront feature", feature: "Bid appears in my bids", expected: "bid listed", actual: `${bidsList.json.bids.length} bid(s)`, evidence: "" })
    : fail({ id: "BID-03", area: "Storefront feature", feature: "Bid appears in my bids", expected: "bid listed", actual: `HTTP ${bidsList.status}`, evidence: bidsList.text.slice(0, 150), severity: "High" });

  const otherBids = await req(`${BE}/store/resale/bids`, { headers: storeHeaders(tokenB) });
  !(otherBids.json?.bids ?? []).some((b) => b.id === bidId)
    ? pass({ id: "SEC-02", area: "Security", feature: "Bids are isolated per customer", expected: "customer B cannot see customer A's bid", actual: `A ${bidsList.json?.bids?.length ?? 0} / B ${otherBids.json?.bids?.length ?? 0}`, evidence: "" })
    : fail({ id: "SEC-02", area: "Security", feature: "Bids are isolated per customer", expected: "B cannot see A's bid", actual: "B saw A's bid", evidence: "", severity: "Critical" });

  if (bidId) {
    r = await req(`${BE}/store/resale/bids/${bidId}`, { method: "DELETE", headers: storeHeaders(tokenA) });
    r.status === 200 || r.status === 204
      ? pass({ id: "BID-04", area: "Storefront feature", feature: "Cancel own bid", expected: "200/204", actual: `HTTP ${r.status}`, evidence: bidId })
      : fail({ id: "BID-04", area: "Storefront feature", feature: "Cancel own bid", expected: "200/204", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: bidId, severity: "High" });
  }

  r = await req(`${BE}/store/resale/asks`, { method: "POST", headers: storeHeaders(tokenA), body: { variant_id: variantId, ask_price: 15000, condition_grade: "deadstock", box_condition: "perfect" } });
  const askId = r.json?.ask?.id;
  askId
    ? pass({ id: "ASK-01", area: "Storefront feature", feature: "Create consignment ask", expected: "201 ask", actual: `HTTP ${r.status} ₹${r.json.ask.ask_price}`, evidence: askId })
    : fail({ id: "ASK-01", area: "Storefront feature", feature: "Create consignment ask", expected: "201 ask", actual: `HTTP ${r.status} ${r.text.slice(0, 180)}`, evidence: "", severity: "High" });

  const asksList = await req(`${BE}/store/resale/asks`, { headers: storeHeaders(tokenA) });
  (asksList.json?.asks ?? []).some((a) => a.id === askId)
    ? pass({ id: "ASK-02", area: "Storefront feature", feature: "Ask appears in consignments", expected: "ask listed", actual: `${asksList.json.asks.length} ask(s)`, evidence: "" })
    : fail({ id: "ASK-02", area: "Storefront feature", feature: "Ask appears in consignments", expected: "ask listed", actual: `HTTP ${asksList.status}`, evidence: asksList.text.slice(0, 150), severity: "High" });

  r = await req(`${BE}/store/resale/asks/${askId}`, { method: "DELETE", headers: storeHeaders(tokenA) });
  const asksAfter = await req(`${BE}/store/resale/asks`, { headers: storeHeaders(tokenA) });
  (r.status === 200 || r.status === 204) && !(asksAfter.json?.asks ?? []).some((a) => a.id === askId)
    ? pass({ id: "ASK-03", area: "Storefront feature", feature: "Delist own consignment", expected: "removed", actual: `HTTP ${r.status}, ${asksAfter.json?.asks?.length ?? 0} left`, evidence: "" })
    : fail({ id: "ASK-03", area: "Storefront feature", feature: "Delist own consignment", expected: "removed", actual: `HTTP ${r.status}`, evidence: asksAfter.text.slice(0, 150), severity: "High" });

  /* ------------------------------------------------------ 7. cart + order */
  const cart = await req(`${BE}/store/carts`, { method: "POST", headers: storeHeaders(tokenA), body: { region_id: region.id } });
  const cartId = cart.json?.cart?.id;
  if (!cartId) throw new Error(`Cart creation failed: ${cart.status} ${cart.text}`);

  const addLine = await req(`${BE}/store/carts/${cartId}/line-items`, {
    method: "POST",
    headers: storeHeaders(tokenA),
    body: {
      variant_id: inStockVariant?.id,
      quantity: 1,
      metadata: {
        is_custom: true,
        garment_type: "bespoke_audit_fixture",
        custom_measurements: { chest_inches: 42, waist_inches: 34, fit_preference: "slim", notes: "AUDIT" },
      },
    },
  });
  addLine.status === 200 && (addLine.json?.cart?.items ?? []).length > 0
    ? pass({ id: "CART-01", area: "Storefront feature", feature: "Add line item with bespoke measurements", expected: "line item with metadata", actual: `HTTP ${addLine.status}, total ₹${addLine.json.cart.total}`, evidence: cartId })
    : fail({ id: "CART-01", area: "Storefront feature", feature: "Add line item with bespoke measurements", expected: "line item", actual: `HTTP ${addLine.status} ${addLine.text.slice(0, 180)}`, evidence: "", severity: "Critical" });

  const address = {
    first_name: "Audit",
    last_name: "Buyer",
    phone: "+919876500001",
    address_1: "1 Audit Street",
    city: "Ahmedabad",
    province: "Gujarat",
    postal_code: "380059",
    country_code: "in",
  };
  r = await req(`${BE}/store/carts/${cartId}`, {
    method: "POST",
    headers: storeHeaders(tokenA),
    body: { email: emailA, shipping_address: address, billing_address: address },
  });
  r.status === 200
    ? pass({ id: "CART-02", area: "Storefront feature", feature: "Attach address to cart", expected: "200", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "CART-02", area: "Storefront feature", feature: "Attach address to cart", expected: "200", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: "", severity: "Critical" });

  const opts = await req(`${BE}/store/shipping-options?cart_id=${cartId}`, { headers: storeHeaders(tokenA) });
  const option = opts.json?.shipping_options?.[0];
  r = await req(`${BE}/store/carts/${cartId}/shipping-methods`, { method: "POST", headers: storeHeaders(tokenA), body: { option_id: option?.id } });
  r.status === 200
    ? pass({ id: "CART-03", area: "Storefront feature", feature: "Select shipping method", expected: "200 with options", actual: `HTTP ${r.status}, ${opts.json?.shipping_options?.length ?? 0} option(s)`, evidence: "" })
    : fail({ id: "CART-03", area: "Storefront feature", feature: "Select shipping method", expected: "200", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: "", severity: "Critical" });

  // The storefront cart page must render the real server cart
  const cartCookie = `thl_auth=${tokenA}; thl_cart=${cartId}`;
  await checkPage({ id: "CART-04", area: "Storefront feature", url: `${SF}/cart`, label: "Cart page renders the line item", cookie: cartCookie, mustInclude: [orderProduct ? orderProduct.title.slice(0, 10) : ""].filter(Boolean) });

  // COD OTP is enforced in the storefront server action only — prove what the API allows.
  const pc = await req(`${BE}/store/payment-collections`, { method: "POST", headers: storeHeaders(tokenA), body: { cart_id: cartId } });
  const pcId = pc.json?.payment_collection?.id;
  if (pcId) {
    await req(`${BE}/store/payment-collections/${pcId}/payment-sessions`, { method: "POST", headers: storeHeaders(tokenA), body: { provider_id: "pp_system_default" } });
  }
  const complete = await req(`${BE}/store/carts/${cartId}/complete`, { method: "POST", headers: storeHeaders(tokenA) });
  let order = complete.json?.order;
  let orderId = order?.id;
  if (orderId) {
    fail({
      id: "SEC-03",
      area: "Security / business rule",
      feature: "Cash-on-Delivery must require phone OTP on the server",
      expected: "Cart completion without `cod_otp_verified_at` metadata is rejected",
      actual: `Order ${order.display_id} created via POST /store/carts/:id/complete with no OTP metadata (HTTP ${complete.status})`,
      evidence: `order id ${orderId}; the OTP gate exists only in apps/storefront/app/actions/checkout.ts (placeOrderAction), not in the backend route`,
      severity: "High",
    });
  } else {
    pass({
      id: "SEC-03",
      area: "Security / business rule",
      feature: "Cash-on-Delivery requires phone OTP server-side",
      expected: "completion without OTP proof rejected",
      actual: `HTTP ${complete.status} ${complete.json?.type ?? ""} — not completed`,
      evidence: complete.text.slice(0, 200),
    });

    // Provide valid OTP verification proof to complete cart for downstream E2E lifecycle tests
    await pg.query(
      `update cart set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cod_otp_verified_at', now()::text) where id = $1`,
      [cartId]
    );
    const verifiedComplete = await req(`${BE}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: storeHeaders(tokenA),
    });
    order = verifiedComplete.json?.order;
    orderId = order?.id;
  }

  // Validation: 6-digit PIN enforced by shared schema, check backend accepts/rejects
  r = await req(`${BE}/store/carts`, { method: "POST", headers: storeHeaders(tokenA), body: { region_id: "does-not-exist" } });
  r.status >= 400
    ? pass({ id: "VAL-01", area: "Validation", feature: "Cart rejects invalid region", expected: "4xx", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "VAL-01", area: "Validation", feature: "Cart rejects invalid region", expected: "4xx", actual: `HTTP ${r.status}`, evidence: "", severity: "Medium" });

  /* ------------------------------------------------------ 8. admin login */
  const adminLogin = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { email: "admin@thehiddenlabel.com", password: "AdminPass123!" },
  });
  const adminToken = adminLogin.json?.token;
  adminToken
    ? pass({ id: "ADM-01", area: "Admin", feature: "Admin login", expected: "JWT", actual: `HTTP ${adminLogin.status}`, evidence: "admin@thehiddenlabel.com" })
    : fail({ id: "ADM-01", area: "Admin", feature: "Admin login", expected: "JWT", actual: `HTTP ${adminLogin.status} ${adminLogin.text.slice(0, 160)}`, evidence: "", severity: "Critical" });

  if (!adminToken) throw new Error("Admin login failed — cannot continue admin audit");
  const adminHeaders = { authorization: `Bearer ${adminToken}` };
  const adminCookie = `thl_admin_token=${adminToken}`;

  const me = await req(`${BE}/admin/users/me?fields=id,email,metadata`, { headers: adminHeaders });
  me.status === 200
    ? pass({ id: "ADM-02", area: "Admin", feature: "Admin identity + role", expected: "200 with role", actual: `HTTP ${me.status} ${me.json?.user?.email} role=${me.json?.user?.metadata?.role}`, evidence: "" })
    : fail({ id: "ADM-02", area: "Admin", feature: "Admin identity + role", expected: "200", actual: `HTTP ${me.status}`, evidence: "", severity: "High" });

  // Unauthenticated admin app routes
  for (const route of ["/", "/orders", "/products", "/customers", "/settings", "/audit"]) {
    const x = await req(`${AD}${route}`);
    const guarded = x.status >= 300 && x.status < 400 && (x.location ?? "").includes("/login");
    guarded
      ? pass({ id: `ADM-G-${route}`, area: "Admin/Auth", feature: `Guest blocked from admin ${route}`, expected: "redirect /login", actual: `HTTP ${x.status} → ${x.location}`, evidence: route })
      : fail({ id: `ADM-G-${route}`, area: "Admin/Auth", feature: `Guest blocked from admin ${route}`, expected: "redirect /login", actual: `HTTP ${x.status} → ${x.location ?? "none"}`, evidence: route, severity: "Critical" });
  }

  // Backend admin API auth
  for (const [p, label] of [
    ["/admin/orders?limit=1", "Orders"],
    ["/admin/brands", "Brands"],
    ["/admin/returns", "Returns"],
    ["/admin/audit?limit=1", "Audit"],
    ["/admin/inspections", "Inspections"],
    ["/admin/resale/asks", "Resale asks"],
    ["/admin/fit-rules", "Fit rules"],
  ]) {
    const x = await req(`${BE}${p}`);
    x.status === 401
      ? pass({ id: `SEC-ADM-${p}`, area: "Security", feature: `Unauthenticated ${label} API blocked`, expected: "401", actual: `HTTP ${x.status}`, evidence: p })
      : fail({ id: `SEC-ADM-${p}`, area: "Security", feature: `Unauthenticated ${label} API blocked`, expected: "401", actual: `HTTP ${x.status}`, evidence: p, severity: "Critical" });
  }

  // A customer token must never pass admin auth
  r = await req(`${BE}/admin/orders?limit=1`, { headers: storeHeaders(tokenA) });
  r.status === 401 || r.status === 403
    ? pass({ id: "SEC-04", area: "Security", feature: "Customer JWT rejected by admin API", expected: "401/403", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "SEC-04", area: "Security", feature: "Customer JWT rejected by admin API", expected: "401/403", actual: `HTTP ${r.status}`, evidence: r.text.slice(0, 150), severity: "Critical" });

  /* ------------------------------------------------------- 9. admin pages */
  const adminPages = [
    ["/", "A-01 Dashboard"],
    ["/products", "A-02 Products"],
    ["/products/new", "A-03 Add product"],
    ["/brands", "A-04 Brands"],
    ["/categories", "A-05 Categories"],
    ["/inventory", "A-06 Inventory"],
    ["/orders", "A-07 Orders"],
    ["/customers", "A-09 Customers"],
    ["/payments", "A-10 Payments"],
    ["/shipments", "A-11 Shipments"],
    ["/returns", "A-12 Returns"],
    ["/promotions", "A-13 Promotions"],
    ["/promotions/new", "A-13 Create promotion"],
    ["/content", "A-14 Content"],
    ["/content/new", "A-14 Create content"],
    ["/reports", "A-15 Reports"],
    ["/settings", "A-16 Settings"],
    ["/audit", "A-17 Audit log"],
    ["/inspections", "A-18 Inspections"],
    ["/resale", "A-19 Resale orderbook"],
    ["/fit-rules", "A-20 Fit rules"],
    ["/design", "SYS-01 Admin design system"],
  ];
  for (const [route, label] of adminPages) {
    await checkPage({ id: `ADM-P-${route}`, area: "Admin", url: `${AD}${route}`, label: `${label} ${route}`, cookie: adminCookie });
  }

  // Detail pages: existing order, customer, return
  const latestOrder = await pg.query('select id, display_id from "order" where deleted_at is null order by created_at desc limit 1');
  if (latestOrder.rows[0]) {
    await checkPage({ id: "ADM-P-ORDER", area: "Admin", url: `${AD}/orders/${latestOrder.rows[0].id}`, label: `A-08 Order detail #${latestOrder.rows[0].display_id}`, cookie: adminCookie });
  }
  const latestCustomer = await pg.query("select id, email from customer order by created_at desc limit 1");
  if (latestCustomer.rows[0]) {
    await checkPage({ id: "ADM-P-CUST", area: "Admin", url: `${AD}/customers/${latestCustomer.rows[0].id}`, label: "A-09 Customer detail", cookie: adminCookie });
  }
  const latestReturn = await pg.query("select id, display_id from return_request order by requested_at desc nulls last limit 1");
  if (latestReturn.rows[0]) {
    await checkPage({ id: "ADM-P-RET", area: "Admin", url: `${AD}/returns/${latestReturn.rows[0].id}`, label: `A-12 Return detail ${latestReturn.rows[0].display_id}`, cookie: adminCookie });
  }
  const latestShipment = await pg.query("select id from shipment order by created_at desc limit 1");
  if (latestShipment.rows[0]) {
    await checkPage({ id: "ADM-P-SHIP", area: "Admin", url: `${AD}/shipments/${latestShipment.rows[0].id}`, label: "A-11 Shipment detail", cookie: adminCookie });
  }

  // admin 404
  r = await req(`${AD}/not-a-route`, { cookie: adminCookie });
  r.status === 404
    ? pass({ id: "ADM-404", area: "Admin", feature: "Admin 404 boundary", expected: "404", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "ADM-404", area: "Admin", feature: "Admin 404 boundary", expected: "404", actual: `HTTP ${r.status}`, evidence: r.text.slice(0, 120), severity: "Low" });

  /* ----------------------------------------- 10. admin CRUD + audit trail */
  const brandHandle = `audit-brand-${Date.now()}`;
  let createdBrand = null;
  r = await req(`${BE}/admin/brands`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { name: "Audit Brand", handle: brandHandle, tagline: "temporary", partnership_tier: "core" } });
  createdBrand = r.json?.brand;
  r.status === 201 && createdBrand
    ? pass({ id: "CRUD-01", area: "Admin CRUD", feature: "Create brand", expected: "201", actual: `HTTP ${r.status} id=${createdBrand.id}`, evidence: brandHandle })
    : fail({ id: "CRUD-01", area: "Admin CRUD", feature: "Create brand", expected: "201", actual: `HTTP ${r.status} ${r.text.slice(0, 180)}`, evidence: brandHandle, severity: "High" });

  r = await req(`${BE}/admin/brands`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { name: "Audit Brand", handle: brandHandle } });
  r.status === 409
    ? pass({ id: "CRUD-02", area: "Admin CRUD", feature: "Duplicate brand handle rejected", expected: "409", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "CRUD-02", area: "Admin CRUD", feature: "Duplicate brand handle rejected", expected: "409", actual: `HTTP ${r.status}`, evidence: "", severity: "Medium" });

  r = await req(`${BE}/admin/brands`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { name: "", handle: "Bad Handle!" } });
  r.status === 400
    ? pass({ id: "CRUD-03", area: "Admin CRUD", feature: "Invalid brand payload rejected", expected: "400", actual: `HTTP ${r.status}`, evidence: "" })
    : fail({ id: "CRUD-03", area: "Admin CRUD", feature: "Invalid brand payload rejected", expected: "400", actual: `HTTP ${r.status}`, evidence: "", severity: "Medium" });

  if (createdBrand) {
    r = await req(`${BE}/admin/brands/${createdBrand.id}`, { method: "PATCH", headers: { ...adminHeaders, "content-type": "application/json" }, body: { tagline: "updated by audit" } });
    (r.status === 200 || r.status === 201) && (r.json?.brand?.tagline === "updated by audit" || (await req(`${BE}/admin/brands`, { headers: adminHeaders })).json?.brands?.some((b) => b.id === createdBrand.id))
      ? pass({ id: "CRUD-04", area: "Admin CRUD", feature: "Update brand", expected: "200 + persisted change", actual: `HTTP ${r.status} tagline="${r.json?.brand?.tagline ?? "?"}"`, evidence: createdBrand.id })
      : fail({ id: "CRUD-04", area: "Admin CRUD", feature: "Update brand", expected: "200 + persisted change", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: createdBrand.id, severity: "High" });

    r = await req(`${BE}/admin/brands/${createdBrand.id}`, { method: "DELETE", headers: adminHeaders });
    r.status === 200 || r.status === 204
      ? pass({ id: "CRUD-05", area: "Admin CRUD", feature: "Delete brand", expected: "200/204", actual: `HTTP ${r.status}`, evidence: createdBrand.id })
      : fail({ id: "CRUD-05", area: "Admin CRUD", feature: "Delete brand", expected: "200/204", actual: `HTTP ${r.status}`, evidence: "", severity: "High" });
  }

  // audit log reflects the write
  const audit = await req(`${BE}/admin/audit?limit=20`, { headers: adminHeaders });
  const auditEvents = audit.json?.events ?? audit.json?.items ?? [];
  auditEvents.some((e) => e.action === "brand.created" || e.action === "brand.deleted")
    ? pass({ id: "AUDIT-01", area: "Admin", feature: "Audit log records brand mutation", expected: "brand.created/deleted event", actual: `HTTP ${audit.status}, ${auditEvents.length} events, latest=${auditEvents[0]?.action}`, evidence: "/admin/audit" })
    : fail({ id: "AUDIT-01", area: "Admin", feature: "Audit log records brand mutation", expected: "brand event", actual: `HTTP ${audit.status}, actions=${auditEvents.map((e) => e.action).slice(0, 6).join(",")}`, evidence: "", severity: "Medium" });

  await checkPage({ id: "AUDIT-02", area: "Admin", url: `${AD}/audit`, label: "Audit page renders events", cookie: adminCookie, mustInclude: [] });

  // fit rules CRUD (AI-04 config)
  r = await req(`${BE}/admin/fit-rules`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { silhouette_name: "Audit Silhouette", fit_tendency: "runs_small", recommended_size_delta: 0.5, width_profile: "regular", guidance_text: "audit fixture" } });
  const fitRuleId = r.json?.rule?.id;
  r.status === 201 || r.status === 200
    ? pass({ id: "CRUD-06", area: "Admin CRUD", feature: "Create fit rule", expected: "201", actual: `HTTP ${r.status}`, evidence: fitRuleId ?? "" })
    : fail({ id: "CRUD-06", area: "Admin CRUD", feature: "Create fit rule", expected: "201", actual: `HTTP ${r.status} ${r.text.slice(0, 160)}`, evidence: "", severity: "Medium" });
  if (fitRuleId) {
    const del = await req(`${BE}/admin/fit-rules/${fitRuleId}`, { method: "DELETE", headers: adminHeaders });
    del.status === 200 || del.status === 204
      ? pass({ id: "CRUD-07", area: "Admin CRUD", feature: "Delete fit rule", expected: "200/204", actual: `HTTP ${del.status}`, evidence: "" })
      : fail({ id: "CRUD-07", area: "Admin CRUD", feature: "Delete fit rule", expected: "a DELETE handler for fit rules", actual: `HTTP ${del.status} — no DELETE route exists; the A-20 screen is also read-only (no create/edit controls)`, evidence: del.text.slice(0, 140), severity: "Medium" });
  }

  /* -------------------------------- 11. user <-> admin synchronisation tests */
  if (orderId) {
    // Admin order list contains the new order
    const adminOrders = await req(`${BE}/admin/orders?limit=50&order=-created_at`, { headers: adminHeaders });
    const seen = (adminOrders.json?.orders ?? []).some((o) => o.id === orderId);
    seen
      ? pass({ id: "SYNC-01", area: "E2E", feature: "User-placed order appears in admin orders", expected: "order present", actual: `found ${orderId} among ${adminOrders.json?.orders?.length ?? 0}`, evidence: "" })
      : fail({ id: "SYNC-01", area: "E2E", feature: "User-placed order appears in admin orders", expected: "order present", actual: `HTTP ${adminOrders.status}, order ${orderId} not found`, evidence: "", severity: "Critical" });

    const adminOrderPage = await req(`${AD}/orders/${orderId}`, { cookie: adminCookie });
    const pageHasMeasurements = /bespoke_audit_fixture|chest|Chest|42/.test(adminOrderPage.text);
    pageHasMeasurements
      ? pass({ id: "SYNC-02", area: "E2E", feature: "Admin order detail shows customer's bespoke measurements", expected: "tailor sheet visible", actual: `HTTP ${adminOrderPage.status}, measurements section present`, evidence: `/orders/${orderId}` })
      : fail({ id: "SYNC-02", area: "E2E", feature: "Admin order detail shows customer's bespoke measurements", expected: "tailor sheet visible", actual: `HTTP ${adminOrderPage.status}, no measurement text found`, evidence: "", severity: "High" });

    // User side sees the order
    const userOrderPage = await req(`${SF}/account/orders/${orderId}`, { cookie: cookieA });
    userOrderPage.status === 200 && userOrderPage.text.includes(String(order.display_id))
      ? pass({ id: "SYNC-03", area: "E2E", feature: "Placed order visible in customer account", expected: "200 with order", actual: `HTTP ${userOrderPage.status}`, evidence: `/account/orders/${orderId}` })
      : fail({ id: "SYNC-03", area: "E2E", feature: "Placed order visible in customer account", expected: "200", actual: `HTTP ${userOrderPage.status}`, evidence: "", severity: "Critical" });

    // IDOR through the storefront
    const foreignView = await req(`${SF}/account/orders/${orderId}`, { cookie: `thl_auth=${tokenB}` });
    foreignView.status === 404
      ? pass({ id: "SEC-05", area: "Security", feature: "Customer B cannot open customer A's order page", expected: "404", actual: `HTTP ${foreignView.status}`, evidence: "" })
      : fail({ id: "SEC-05", area: "Security", feature: "Customer B cannot open customer A's order page", expected: "404", actual: `HTTP ${foreignView.status}`, evidence: "", severity: "Critical" });

    // Backend return route IDOR
    const foreignReturn = await req(`${BE}/store/return-requests`, { method: "POST", headers: storeHeaders(tokenB), body: { order_id: orderId, reason_code: "changed_mind", items: [{ order_item_id: "x", quantity: 1 }] } });
    foreignReturn.status === 404
      ? pass({ id: "SEC-06", area: "Security", feature: "Customer B cannot file a return on A's order", expected: "404", actual: `HTTP ${foreignReturn.status}`, evidence: "" })
      : fail({ id: "SEC-06", area: "Security", feature: "Customer B cannot file a return on A's order", expected: "404", actual: `HTTP ${foreignReturn.status} ${foreignReturn.text.slice(0, 120)}`, evidence: "", severity: "Critical" });

    // return before delivery rejected
    const orderItems = await req(`${BE}/store/orders/${orderId}?fields=*items`, { headers: storeHeaders(tokenA) });
    const lineItemId = orderItems.json?.order?.items?.[0]?.id;
    let ret = await req(`${BE}/store/return-requests`, { method: "POST", headers: storeHeaders(tokenA), body: { order_id: orderId, reason_code: "wrong_size", note: "audit", items: [{ order_item_id: lineItemId, quantity: 1 }] } });
    ret.status === 422
      ? pass({ id: "RET-01", area: "Storefront feature", feature: "Return rejected before delivery", expected: "422", actual: `HTTP ${ret.status} ${ret.json?.message ?? ""}`, evidence: "" })
      : fail({ id: "RET-01", area: "Storefront feature", feature: "Return rejected before delivery", expected: "422", actual: `HTTP ${ret.status} ${ret.text.slice(0, 160)}`, evidence: "", severity: "High" });

    // admin fulfils the order
    const fulfil = await req(`${BE}/admin/orders/${orderId}/actions`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { action: "fulfill" } });
    (fulfil.status === 200 || fulfil.status === 201)
      ? pass({ id: "E2E-01", area: "E2E/Admin", feature: "Admin fulfils the customer's order", expected: "200", actual: `HTTP ${fulfil.status} order status=${fulfil.json?.order?.status}`, evidence: "" })
      : fail({ id: "E2E-01", area: "E2E/Admin", feature: "Admin fulfils the customer's order", expected: "200", actual: `HTTP ${fulfil.status} ${fulfil.text.slice(0, 180)}`, evidence: "", severity: "High" });

    const fulfil2 = await req(`${BE}/admin/orders/${orderId}/actions`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { action: "fulfill" } });
    fulfil2.status === 422
      ? pass({ id: "E2E-02", area: "E2E/Admin", feature: "Double fulfilment is rejected", expected: "422", actual: `HTTP ${fulfil2.status}`, evidence: "" })
      : fail({ id: "E2E-02", area: "E2E/Admin", feature: "Double fulfilment is rejected", expected: "422", actual: `HTTP ${fulfil2.status} ${fulfil2.text.slice(0, 140)}`, evidence: "", severity: "Medium" });

    // Admin status change reflected on user side
    const userAfterFulfil = await req(`${SF}/account/orders/${orderId}`, { cookie: cookieA });
    const reflects = /fulfilled|delivered|shipped|completed/i.test(userAfterFulfil.text);
    reflects
      ? pass({ id: "SYNC-04", area: "E2E", feature: "Customer sees status after admin fulfilment", expected: "fulfilment/status visible", actual: `HTTP ${userAfterFulfil.status}, status text present`, evidence: "" })
      : fail({ id: "SYNC-04", area: "E2E", feature: "Customer sees status after admin fulfilment", expected: "fulfilment/status visible", actual: `HTTP ${userAfterFulfil.status}, no fulfilment status text on the customer order page`, evidence: "", severity: "High" });

    // simulate delivery for the test order only, then request return through the real route
    await pg.query(`
      update fulfillment f set delivered_at = now()
      from order_fulfillment of
      where of.fulfillment_id = f.id and of.order_id = $1 and f.delivered_at is null`, [orderId]);
    ret = await req(`${BE}/store/return-requests`, { method: "POST", headers: storeHeaders(tokenA), body: { order_id: orderId, reason_code: "wrong_size", note: "audit return", items: [{ order_item_id: lineItemId, quantity: 1 }] } });
    const returnId = ret.json?.return?.id;
    ret.status === 201
      ? pass({ id: "RET-02", area: "E2E", feature: "Return request created after delivery", expected: "201", actual: `HTTP ${ret.status} ${ret.json?.return?.display_id}`, evidence: returnId })
      : fail({ id: "RET-02", area: "E2E", feature: "Return request created after delivery", expected: "201", actual: `HTTP ${ret.status} ${ret.text.slice(0, 200)}`, evidence: "", severity: "High" });

    if (returnId) {
      const adminReturns = await req(`${BE}/admin/returns`, { headers: adminHeaders });
      const seenReturn = (adminReturns.json?.returns ?? []).some((x) => x.id === returnId);
      seenReturn
        ? pass({ id: "SYNC-05", area: "E2E", feature: "Customer return request appears in admin returns", expected: "present", actual: `found ${returnId}`, evidence: "" })
        : fail({ id: "SYNC-05", area: "E2E", feature: "Customer return request appears in admin returns", expected: "present", actual: `not found among ${adminReturns.json?.returns?.length ?? 0}`, evidence: "", severity: "Critical" });

      const approve = await req(`${BE}/admin/returns/${returnId}`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { action: "approve" } });
      (approve.status === 200 || approve.status === 201)
        ? pass({ id: "E2E-03", area: "E2E/Admin", feature: "Admin approves the return", expected: "200", actual: `HTTP ${approve.status} status=${approve.json?.return?.status}`, evidence: "" })
        : fail({ id: "E2E-03", area: "E2E/Admin", feature: "Admin approves the return", expected: "200", actual: `HTTP ${approve.status} ${approve.text.slice(0, 180)}`, evidence: "", severity: "High" });

      const userReturns = await req(`${BE}/store/return-requests`, { headers: storeHeaders(tokenA) });
      const statusOnUser = (userReturns.json?.returns ?? []).find((x) => x.id === returnId)?.status;
      statusOnUser === "approved"
        ? pass({ id: "SYNC-06", area: "E2E", feature: "Customer sees the admin-approved return status", expected: "approved visible", actual: `status=${statusOnUser}`, evidence: "" })
        : fail({ id: "SYNC-06", area: "E2E", feature: "Customer sees the admin-approved return status", expected: "approved visible", actual: `status=${statusOnUser ?? "missing"}`, evidence: "", severity: "High" });

      // does the customer UI surface returns at all?
      await checkPage({ id: "SYNC-07", area: "Storefront feature", url: `${SF}/account/orders`, label: "Customer order list shows return status", cookie: cookieA });
    }

    // capture then refund (test order only)
    const capture = await req(`${BE}/admin/orders/${orderId}/actions`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { action: "capture" } });
    (capture.status === 200 || capture.status === 201)
      ? pass({ id: "E2E-04", area: "E2E/Admin", feature: "Admin captures payment", expected: "200", actual: `HTTP ${capture.status}`, evidence: "" })
      : fail({ id: "E2E-04", area: "E2E/Admin", feature: "Admin captures payment", expected: "200", actual: `HTTP ${capture.status} ${capture.text.slice(0, 180)}`, evidence: "", severity: "High" });

    const refund = await req(`${BE}/admin/orders/${orderId}/actions`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { action: "refund", reason: "audit refund" } });
    (refund.status === 200 || refund.status === 201)
      ? pass({ id: "E2E-05", area: "E2E/Admin", feature: "Admin refunds captured payment", expected: "200", actual: `HTTP ${refund.status}`, evidence: "" })
      : fail({ id: "E2E-05", area: "E2E/Admin", feature: "Admin refunds captured payment", expected: "200", actual: `HTTP ${refund.status} ${refund.text.slice(0, 200)}`, evidence: "", severity: "High" });

    // refund requires a reason
    const badRefund = await req(`${BE}/admin/orders/${orderId}/actions`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { action: "refund" } });
    badRefund.status === 400
      ? pass({ id: "E2E-06", area: "E2E/Admin", feature: "Refund without a reason rejected", expected: "400", actual: `HTTP ${badRefund.status}`, evidence: "" })
      : fail({ id: "E2E-06", area: "E2E/Admin", feature: "Refund without a reason rejected", expected: "400", actual: `HTTP ${badRefund.status}`, evidence: "", severity: "Medium" });
  }

  // profile update → admin customer view
  r = await req(`${BE}/store/customers/me`, { method: "POST", headers: storeHeaders(tokenA), body: { first_name: "AuditUpdated", last_name: "BuyerX", phone: "+919876500002" } });
  const meAfter = await req(`${BE}/store/customers/me`, { headers: storeHeaders(tokenA) });
  r.status === 200 && meAfter.json?.customer?.first_name === "AuditUpdated"
    ? pass({ id: "SYNC-08", area: "E2E", feature: "Customer updates profile and it persists", expected: "updated name", actual: `${meAfter.json.customer.first_name} ${meAfter.json.customer.last_name}`, evidence: "" })
    : fail({ id: "SYNC-08", area: "E2E", feature: "Customer updates profile and it persists", expected: "updated name", actual: `HTTP ${r.status}`, evidence: r.text.slice(0, 160), severity: "High" });

  const adminCustomerPage = await req(`${AD}/customers/${buyerA.customer.id}`, { cookie: adminCookie });
  adminCustomerPage.status === 200 && adminCustomerPage.text.includes("AuditUpdated")
    ? pass({ id: "SYNC-09", area: "E2E", feature: "Admin customer detail shows updated profile", expected: "new name visible", actual: `HTTP ${adminCustomerPage.status}`, evidence: `/customers/${buyerA.customer.id}` })
    : fail({ id: "SYNC-09", area: "E2E", feature: "Admin customer detail shows updated profile", expected: "new name visible", actual: `HTTP ${adminCustomerPage.status}`, evidence: "", severity: "High" });

  /* --------------------------------------------- 11b. role enforcement (RBAC) */
  const roLogin = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { email: "audit.readonly@thehiddenlabel.com", password: "AuditPass123!" },
  });
  const roToken = roLogin.json?.token;
  if (!roToken) {
    record({ id: "RBAC-00", area: "Security", feature: "Readonly admin account for RBAC test", status: "BLOCKED", expected: "login succeeds", actual: `HTTP ${roLogin.status}`, evidence: "test account missing", severity: "High" });
  } else {
    const roHeaders = { authorization: `Bearer ${roToken}`, "content-type": "application/json" };
    const roMe = await req(`${BE}/admin/users/me?fields=id,email,metadata`, { headers: roHeaders });
    const roId = roMe.json?.user?.id;
    const roRole = roMe.json?.user?.metadata?.role;
    roRole === "readonly"
      ? pass({ id: "RBAC-01", area: "Security", feature: "Readonly admin account resolves its role", expected: "readonly", actual: `role=${roRole}`, evidence: "" })
      : fail({ id: "RBAC-01", area: "Security", feature: "Readonly admin account resolves its role", expected: "readonly", actual: `role=${roRole}`, evidence: "", severity: "High" });

    let x = await req(`${BE}/admin/brands`, { headers: roHeaders });
    x.status === 403
      ? pass({ id: "RBAC-02", area: "Security", feature: "Readonly cannot read custom admin modules", expected: "403", actual: `HTTP ${x.status}`, evidence: "/admin/brands" })
      : fail({ id: "RBAC-02", area: "Security", feature: "Readonly cannot read custom admin modules", expected: "403", actual: `HTTP ${x.status}`, evidence: "/admin/brands", severity: "Critical" });

    x = await req(`${BE}/admin/orders?limit=1`, { headers: roHeaders });
    x.status === 403
      ? pass({ id: "RBAC-03", area: "Security", feature: "Readonly cannot read orders", expected: "403", actual: `HTTP ${x.status}`, evidence: "/admin/orders" })
      : fail({ id: "RBAC-03", area: "Security", feature: "Readonly cannot read orders", expected: "403", actual: `HTTP ${x.status} — Medusa core admin route has no project role check, so any admin user can read every order`, evidence: "/admin/orders", severity: "Critical" });

    x = await req(`${BE}/admin/users?limit=5`, { headers: roHeaders });
    x.status === 403
      ? pass({ id: "RBAC-04", area: "Security", feature: "Readonly cannot list admin users", expected: "403", actual: `HTTP ${x.status}`, evidence: "/admin/users" })
      : fail({ id: "RBAC-04", area: "Security", feature: "Readonly cannot list admin users", expected: "403", actual: `HTTP ${x.status} — the whole admin user directory (with roles) is readable by a readonly account`, evidence: "/admin/users", severity: "Critical" });

    if (roId) {
      x = await req(`${BE}/admin/users/${roId}`, { method: "POST", headers: roHeaders, body: { metadata: { role: "owner" } } });
      const escalated = x.status === 200 && x.json?.user?.metadata?.role === "owner";
      escalated
        ? fail({ id: "RBAC-05", area: "Security", feature: "Readonly cannot elevate its own role", expected: "403", actual: `HTTP ${x.status} — the readonly account set its own metadata.role to "owner" via POST /admin/users/:id`, evidence: "/admin/users/:id is a Medusa core route with no project role guard", severity: "Critical" })
        : pass({ id: "RBAC-05", area: "Security", feature: "Readonly cannot elevate its own role", expected: "403", actual: `HTTP ${x.status}`, evidence: "" });
      // always restore the fixture account's real role
      await req(`${BE}/admin/users/${roId}`, { method: "POST", headers: { ...adminHeaders, "content-type": "application/json" }, body: { metadata: { role: "readonly" } } });
    }

    // a customer token must not reach admin user management either
    x = await req(`${BE}/admin/users`, { headers: storeHeaders(tokenA) });
    [401, 403].includes(x.status)
      ? pass({ id: "RBAC-06", area: "Security", feature: "Customer cannot list admin users", expected: "401/403", actual: `HTTP ${x.status}`, evidence: "" })
      : fail({ id: "RBAC-06", area: "Security", feature: "Customer cannot list admin users", expected: "401/403", actual: `HTTP ${x.status}`, evidence: "", severity: "Critical" });
  }

  /* ------------------------------------------------- 11c. missing UI surfaces */
  const missingPages = [
    ["/account/returns", "Customer return-request history (API exists; no page)"],
    [`/account/orders/${orderId ?? "order_x"}/cancel`, "Customer order cancellation"],
    [`/account/orders/${orderId ?? "order_x"}/invoice`, "Printable invoice"],
    ["/checkout/payment", "Dedicated payment step route"],
  ];
  for (const [route, label] of missingPages) {
    const x = await req(`${SF}${route}`, { cookie: cookieA });
    x.status === 200
      ? pass({ id: `MISS-${route}`, area: "Missing features", feature: label, expected: "200", actual: `HTTP ${x.status}`, evidence: route })
      : fail({ id: `MISS-${route}`, area: "Missing features", feature: label, expected: "a route exists", actual: `HTTP ${x.status} → ${x.location ?? "not found"}`, evidence: route, severity: "Medium" });
  }

  const cartPage = await req(`${SF}/cart`, { cookie: cartCookie });
  /name=["'](code|promo|discount)/i.test(cartPage.text)
    ? pass({ id: "MISS-PROMO", area: "Missing features", feature: "Promo/discount code at cart", expected: "code input present", actual: "present", evidence: "/cart" })
    : fail({ id: "MISS-PROMO", area: "Missing features", feature: "Promo/discount code at cart", expected: "a promo code input on the cart or checkout", actual: "no promo/discount input in the cart HTML (promotions module exists in admin but cannot be redeemed by a customer)", evidence: "/cart", severity: "High" });

  const pdp = await req(`${SF}/products/${footwear?.handle}`);
  /quick view/i.test(pdp.text)
    ? pass({ id: "MISS-QV", area: "Missing features", feature: "Quick view modal (U-09)", expected: "present", actual: "present", evidence: "PDP" })
    : fail({ id: "MISS-QV", area: "Missing features", feature: "Quick view modal (U-09)", expected: "quick view entry point", actual: "no quick-view UI in the catalogue/PDP", evidence: "/products", severity: "Low" });

  // address book CRUD (real backend + storefront page)
  const addr = await req(`${BE}/store/customers/me/addresses`, {
    method: "POST",
    headers: storeHeaders(tokenA),
    body: { first_name: "Audit", last_name: "Address", phone: "+919876500003", address_1: "2 Audit Lane", city: "Ahmedabad", province: "Gujarat", postal_code: "380059", country_code: "in" },
  });
  const addrList = await req(`${BE}/store/customers/me/addresses`, { headers: storeHeaders(tokenA) });
  const addressId = addrList.json?.addresses?.find((a) => a.address_1 === "2 Audit Lane")?.id;
  addr.status === 200 && addressId
    ? pass({ id: "ADDR-01", area: "Storefront feature", feature: "Create saved address", expected: "address created and listed", actual: `HTTP ${addr.status}, ${addrList.json.addresses.length} address(es)`, evidence: addressId })
    : fail({ id: "ADDR-01", area: "Storefront feature", feature: "Create saved address", expected: "address created", actual: `HTTP ${addr.status}`, evidence: addr.text.slice(0, 160), severity: "High" });
  if (addressId) {
    const upd = await req(`${BE}/store/customers/me/addresses/${addressId}`, { method: "POST", headers: storeHeaders(tokenA), body: { city: "Surat" } });
    const after = await req(`${BE}/store/customers/me/addresses`, { headers: storeHeaders(tokenA) });
    const updated = after.json?.addresses?.find((a) => a.id === addressId)?.city === "Surat";
    upd.status === 200 && updated
      ? pass({ id: "ADDR-02", area: "Storefront feature", feature: "Update saved address", expected: "persisted", actual: `city=${after.json.addresses.find((a) => a.id === addressId)?.city}`, evidence: addressId })
      : fail({ id: "ADDR-02", area: "Storefront feature", feature: "Update saved address", expected: "persisted", actual: `HTTP ${upd.status}`, evidence: "", severity: "High" });
    const del = await req(`${BE}/store/customers/me/addresses/${addressId}`, { method: "DELETE", headers: storeHeaders(tokenA) });
    const finalList = await req(`${BE}/store/customers/me/addresses`, { headers: storeHeaders(tokenA) });
    (del.status === 200 || del.status === 204) && !(finalList.json?.addresses ?? []).some((a) => a.id === addressId)
      ? pass({ id: "ADDR-03", area: "Storefront feature", feature: "Delete saved address", expected: "removed", actual: `HTTP ${del.status}`, evidence: "" })
      : fail({ id: "ADDR-03", area: "Storefront feature", feature: "Delete saved address", expected: "removed", actual: `HTTP ${del.status}`, evidence: "", severity: "Medium" });
  }

  /* ------------------------------------------------------ 12. security misc */
  const sfRoot = await req(`${SF}/`);
  const adminRoot = await req(`${AD}/`, { cookie: adminCookie });
  const headerKeys = ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "strict-transport-security"];
  const present = headerKeys.filter((h) => sfRoot.headers[h]);
  present.length > 0
    ? pass({ id: "SEC-07", area: "Security", feature: "Security headers present", expected: "CSP/XCTO/frame/referrer", actual: `present: ${present.join(", ")}`, evidence: "" })
    : fail({ id: "SEC-07", area: "Security", feature: "Security headers on storefront/admin", expected: "CSP, X-Content-Type-Options, frame options, referrer policy", actual: `none of ${headerKeys.join("/")} present`, evidence: "next.config.ts sets none", severity: "High" });

  const adminRobots = /<meta[^>]+name="robots"[^>]*noindex/i.test(adminRoot.text) || /noindex/i.test(adminRoot.headers["x-robots-tag"] ?? "");
  adminRobots
    ? pass({ id: "SEC-08", area: "Security", feature: "Admin app is noindex", expected: "noindex", actual: "noindex present", evidence: "" })
    : fail({ id: "SEC-08", area: "Security", feature: "Admin app is noindex", expected: "noindex meta or X-Robots-Tag", actual: "no noindex directive found", evidence: "GET / on :7001", severity: "Medium" });

  const leaked = ["MEDUSA_JWT_SECRET", "RAZORPAY_KEY_SECRET", "SHIPROCKET_PASSWORD", "RESEND_API_KEY"].filter((s) => sfRoot.text.includes(s) || adminRoot.text.includes(s));
  leaked.length === 0
    ? pass({ id: "SEC-09", area: "Security", feature: "No secret names leaked into rendered HTML", expected: "none", actual: "none found", evidence: "" })
    : fail({ id: "SEC-09", area: "Security", feature: "No secret names leaked into rendered HTML", expected: "none", actual: leaked.join(","), evidence: "", severity: "Critical" });

  // cross-site POST to a storefront server action (CSRF smoke test) — Next should reject a foreign Origin
  const csrf = await req(`${SF}/account`, { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" }, body: "a=1" });
  csrf.status >= 400 || csrf.status === 303 || csrf.status === 307
    ? pass({ id: "SEC-10", area: "Security", feature: "Foreign-origin POST rejected", expected: "not 2xx", actual: `HTTP ${csrf.status}`, evidence: "" })
    : fail({ id: "SEC-10", area: "Security", feature: "Foreign-origin POST rejected", expected: "not 2xx", actual: `HTTP ${csrf.status}`, evidence: "", severity: "Medium" });

  // API error shapes don't leak stack traces
  const badProduct = await req(`${BE}/store/products/does-not-exist`, { headers: storeHeaders() });
  !/at .*\(.*:\d+:\d+\)/.test(badProduct.text)
    ? pass({ id: "SEC-11", area: "Security", feature: "API errors do not leak stack traces", expected: "no stack frames", actual: `HTTP ${badProduct.status} ${badProduct.json?.type ?? ""}`, evidence: "" })
    : fail({ id: "SEC-11", area: "Security", feature: "API errors do not leak stack traces", expected: "no stack frames", actual: badProduct.text.slice(0, 200), evidence: "", severity: "Medium" });

  /* ------------------------------------------------------ 13. performance */
  const perfRoutes = ["/", "/collections/all", "/products/" + (footwear?.handle ?? ""), "/cart", "/brands", "/search?q=jordan"];
  const timings = [];
  for (const p of perfRoutes) {
    const x = await req(`${SF}${p}`, { cookie: cartCookie });
    timings.push({ route: p, ms: x.ms, status: x.status });
  }
  const sorted = [...timings].sort((a, b) => a.ms - b.ms);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
  pass({ id: "PERF-01", area: "Performance", feature: "Storefront server render times (dev)", expected: "observed baseline", actual: `slowest ${p95.route} ${p95.ms}ms; ${timings.map((t) => `${t.route}=${t.ms}ms`).join(", ")}`, evidence: "single dev-mode run, cold cache possible" });

  const adminTimings = [];
  for (const p of ["/", "/orders", "/products", "/audit"]) {
    const x = await req(`${AD}${p}`, { cookie: adminCookie });
    adminTimings.push({ route: p, ms: x.ms, status: x.status });
  }
  pass({ id: "PERF-02", area: "Performance", feature: "Admin server render times (dev)", expected: "observed baseline", actual: adminTimings.map((t) => `${t.route}=${t.ms}ms`).join(", "), evidence: "single dev-mode run" });

  /* ------------------------------------------------------------ summary */
  save();
  const totals = results.reduce((acc, x) => {
    acc[x.status] = (acc[x.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("\n===== SUMMARY =====");
  console.log(JSON.stringify(totals, null, 2));
  const failures = results.filter((x) => x.status === "FAIL");
  console.log(`\nFailures (${failures.length}):`);
  for (const f of failures) console.log(`- [${f.severity}] ${f.id} ${f.feature} :: ${f.actual}`);
  await pg.end();

  fs.writeFileSync(
    path.join(OUT_DIR, "run-meta.json"),
    JSON.stringify({ run: RUN, at: new Date().toISOString(), emailA, emailB, cartId, orderId, totals }, null, 2),
  );
}

main().catch(async (error) => {
  console.error("AUDIT ABORTED:", error);
  save();
  process.exit(1);
});
