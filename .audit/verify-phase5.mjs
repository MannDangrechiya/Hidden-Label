/**
 * Phase 5 — user/storefront journey, as far as it can run without payment credentials.
 *
 * Steps: OTP issue → OTP verify → customer registration → catalogue → PDP → cart → address →
 * shipping option → payment-provider gate. With no Razorpay keys the store correctly offers no
 * provider, so the run reports the payment/order steps as BLOCKED rather than pretending.
 *
 * Run with the backend on :9000 and PostgreSQL on :5437.
 */
import fs from "node:fs";
import { Client } from "pg";

const BE = "http://localhost:9000";
const PK = /^\s*MEDUSA_PUBLISHABLE_KEY=(.+)$/m.exec(
  fs.readFileSync("apps/storefront/.env.local", "utf8"),
)[1].trim();
const IN_STOCK_VARIANT = "variant_01M7EV7ZGXASRY2F18DM0XYDMX";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}
function blocked(name, detail) {
  results.push({ name, pass: null, detail });
  console.log(`BLOCKED ${name} — ${detail}`);
}

async function req(url, { method = "GET", headers = {}, body, key = true } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(key ? { "x-publishable-api-key": PK } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, text, json };
}

const email = `phase5.audit.${Date.now()}@example.com`;
const password = "AuditPass123!";
const pg = new Client({
  host: "127.0.0.1",
  port: 5437,
  user: "postgres",
  database: "the_hidden_label",
});
await pg.connect();
const createdCarts = [];

try {
  // 1. OTP to an email destination (dev echo is enabled in apps/backend/.env).
  const send = await req(`${BE}/store/otp/send`, {
    method: "POST",
    body: { destination: email, channel: "email", purpose: "email_verify" },
  });
  check("OTP issued", send.status === 201 && Boolean(send.json?.challenge_id), `status=${send.status}`);

  const verify = await req(`${BE}/store/otp/verify`, {
    method: "POST",
    body: { challenge_id: send.json?.challenge_id, code: send.json?.dev_code ?? "000000" },
  });
  check(
    "OTP verified",
    verify.status === 200 && verify.json?.verified === true,
    `status=${verify.status} verified=${verify.json?.verified}`,
  );

  // 2. Register the auth identity, then the customer profile.
  const register = await req(`${BE}/auth/customer/emailpass/register`, {
    method: "POST",
    body: { email, password },
    key: false,
  });
  check(
    "customer auth identity created",
    register.status === 200 && Boolean(register.json?.token),
    `status=${register.status}`,
  );
  const registrationToken = register.json?.token;

  const customer = await req(`${BE}/store/customers`, {
    method: "POST",
    headers: { authorization: `Bearer ${registrationToken}` },
    body: { email, first_name: "Phase", last_name: "Five" },
  });
  const customerId = customer.json?.customer?.id;
  check("customer profile created", customer.status === 200 && Boolean(customerId), `status=${customer.status}`);

  // The token issued before the customer existed carries no customer actor, so sign in again —
  // exactly what registerAction does in apps/storefront/app/actions/auth.ts.
  const login = await req(`${BE}/auth/customer/emailpass`, {
    method: "POST",
    body: { email, password },
    key: false,
  });
  const token = login.json?.token;
  check("customer can sign in", login.status === 200 && Boolean(token), `status=${login.status}`);

  // 3. Catalogue + PDP.
  const products = await req(`${BE}/store/products?limit=5`);
  check(
    "catalogue lists products",
    products.status === 200 && (products.json?.products?.length ?? 0) > 0,
    `status=${products.status} count=${products.json?.products?.length}`,
  );

  const handleRow = await pg.query(
    "select p.handle from product_variant pv join product p on p.id = pv.product_id where pv.id = $1",
    [IN_STOCK_VARIANT],
  );
  const handle = handleRow.rows[0]?.handle;
  const pdp = await req(`${BE}/store/products?handle=${handle}`);
  check(
    "PDP resolves by handle",
    pdp.status === 200 && pdp.json?.products?.[0]?.handle === handle,
    `handle=${handle} status=${pdp.status}`,
  );

  // 4. Cart for the authenticated customer.
  const regions = await req(`${BE}/store/regions`);
  const region = regions.json.regions.find((r) => r.currency_code === "inr") ?? regions.json.regions[0];
  const cart = await req(`${BE}/store/carts`, {
    method: "POST",
    body: { region_id: region.id },
  });
  const cartId = cart.json?.cart?.id;
  createdCarts.push(cartId);

  const attach = await req(`${BE}/store/carts/${cartId}/customer`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: {},
  });
  check(
    "cart attached to customer",
    attach.status === 200 && attach.json?.cart?.customer_id === customerId,
    `status=${attach.status}`,
  );

  const add = await req(`${BE}/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: { variant_id: IN_STOCK_VARIANT, quantity: 1 },
  });
  const lineItem = add.json?.cart?.items?.[0];
  check(
    "line item added with tax",
    add.status === 200 && Number(add.json?.cart?.tax_total) > 0,
    `status=${add.status} subtotal=${add.json?.cart?.subtotal} tax=${add.json?.cart?.tax_total}`,
  );

  // 5. Address + shipping options.
  const address = {
    first_name: "Phase",
    last_name: "Five",
    phone: "+919876543210",
    address_1: "1 Audit Road",
    city: "Ahmedabad",
    province: "Gujarat",
    postal_code: "380059",
    country_code: "in",
    metadata: { address_type: "home", landmark: "Audit" },
  };
  const addr = await req(`${BE}/store/carts/${cartId}`, {
    method: "POST",
    body: { email, shipping_address: address, billing_address: address },
  });
  check(
    "delivery address saved",
    addr.status === 200 && addr.json?.cart?.shipping_address?.province === "Gujarat",
    `status=${addr.status}`,
  );

  const options = await req(`${BE}/store/shipping-options?cart_id=${cartId}`);
  const option = options.json?.shipping_options?.[0];
  check(
    "shipping option offered",
    options.status === 200 && Boolean(option?.id),
    `status=${options.status} options=${options.json?.shipping_options?.length}`,
  );

  if (option) {
    const ship = await req(`${BE}/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      body: { option_id: option.id },
    });
    check("shipping method selected", ship.status === 200, `status=${ship.status}`);
  }

  // 6. Payment gate.
  const providers = await req(`${BE}/store/payment-providers?region_id=${region.id}`);
  const ids = (providers.json?.payment_providers ?? []).map((p) => p.id);
  check(
    "only prepaid providers offered",
    providers.status === 200 && !ids.includes("pp_system_default"),
    `providers=[${ids.join(",")}]`,
  );

  if (ids.length === 0) {
    blocked(
      "Razorpay payment → order completion → order.placed email",
      "no provider is linked because RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not set in this environment",
    );
  }

  // 7. Return review of the line item metadata (HSN for the invoice).
  check(
    "cart total is tax inclusive and non-zero",
    Number(add.json?.cart?.total) > Number(add.json?.cart?.subtotal),
    `total=${add.json?.cart?.total} subtotal=${add.json?.cart?.subtotal}`,
  );
  console.log(
    `line item: sku=${lineItem?.variant_sku ?? "n/a"} unit_price=${lineItem?.unit_price} total=${lineItem?.total}`,
  );
} finally {
  for (const id of createdCarts.filter(Boolean)) {
    await pg.query("delete from cart where id = $1", [id]);
  }
  await pg
    .query("delete from customer where email = $1", [email])
    .catch(() => undefined);
  await pg.end();
}

const passed = results.filter((r) => r.pass === true).length;
const failed = results.filter((r) => r.pass === false).length;
const skipped = results.filter((r) => r.pass === null).length;
console.log(`\n${passed}/${results.length - skipped} executed checks passed, ${failed} failed, ${skipped} blocked`);
process.exit(failed > 0 ? 1 : 0);
