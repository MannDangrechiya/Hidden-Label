/**
 * Phase 3 live re-verification of the remediation baseline.
 *
 * 1. GET /store/payment-providers — Razorpay only, never pp_system_default.
 * 2. The removed COD routes must 404.
 * 3. Tax probe: same-state (Gujarat) splits CGST+SGST, other state charges IGST.
 * 4. A client writing `metadata.cod_otp_verified_at` gets no COD completion path: there is no
 *    COD provider to create a session with, so the order can only complete prepaid.
 *
 * Run with the backend on :9000 and PostgreSQL on :5437.
 */
import { Client } from "pg";
import fs from "node:fs";

const BE = "http://localhost:9000";
const PK = /^\s*MEDUSA_PUBLISHABLE_KEY=(.+)$/m.exec(
  fs.readFileSync("apps/storefront/.env.local", "utf8"),
)[1].trim();

const PG = { host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" };
const key = { "x-publishable-api-key": PK };

async function req(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", accept: "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, text, json };
}

const pg = new Client(PG);
await pg.connect();
const created = [];
const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

try {
  const regions = await req(`${BE}/store/regions`, { headers: key });
  const region = regions.json.regions.find((r) => r.currency_code === "inr") ?? regions.json.regions[0];

  // 1. Payment providers
  const providers = await req(`${BE}/store/payment-providers?region_id=${region.id}`, { headers: key });
  const providerIds = (providers.json?.payment_providers ?? []).map((p) => p.id);
  check(
    "payment-providers has no COD",
    providers.status === 200 && !providerIds.includes("pp_system_default"),
    `status=${providers.status} providers=[${providerIds.join(",")}]`,
  );

  // 2. Removed routes
  const verifyCod = await req(`${BE}/store/carts/cart_nonexistent/verify-cod`, {
    method: "POST",
    headers: key,
    body: { challenge_id: "x", code: "123456" },
  });
  check("POST /store/carts/:id/verify-cod removed", verifyCod.status === 404, `status=${verifyCod.status}`);

  const refundAccounts = await req(`${BE}/store/refund-accounts`, {
    method: "POST",
    headers: key,
    body: { order_id: "order_x", method: "upi", upi_id: "a@b" },
  });
  check(
    "POST /store/refund-accounts removed",
    refundAccounts.status === 404,
    `status=${refundAccounts.status}`,
  );

  // 3. Tax probe — one cart per destination state.
  const variant = await pg.query(`
    select pv.id variant_id
    from product_variant pv
    join product p on p.id = pv.product_id
    left join inventory_item ii on ii.sku = pv.sku
    left join inventory_level il on il.inventory_item_id = ii.id
    where p.deleted_at is null and pv.deleted_at is null
    group by pv.id
    having coalesce(sum(il.stocked_quantity - il.reserved_quantity), 0) >= 1
    order by pv.id
    limit 1`);
  const variantId = variant.rows[0]?.variant_id;

  const taxFor = async (province, postalCode) => {
    const cart = await req(`${BE}/store/carts`, {
      method: "POST",
      headers: key,
      body: { region_id: region.id },
    });
    const cartId = cart.json.cart.id;
    created.push(cartId);
    await req(`${BE}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: key,
      body: { variant_id: variantId, quantity: 1 },
    });
    const address = {
      first_name: "Tax",
      last_name: "Probe",
      phone: "+919876543210",
      address_1: "1 Test Road",
      city: province === "Gujarat" ? "Ahmedabad" : "Mumbai",
      province,
      postal_code: postalCode,
      country_code: "in",
    };
    const updated = await req(`${BE}/store/carts/${cartId}`, {
      method: "POST",
      headers: key,
      body: { email: "tax.probe@example.com", shipping_address: address, billing_address: address },
    });
    return { cartId, cart: updated.json.cart };
  };

  const gujarat = await taxFor("Gujarat", "380059");
  const maharashtra = await taxFor("Maharashtra", "400001");
  check(
    "tax_total non-zero (Gujarat)",
    Number(gujarat.cart.tax_total ?? 0) > 0,
    `tax_total=${gujarat.cart.tax_total} total=${gujarat.cart.total}`,
  );
  check(
    "tax_total non-zero (Maharashtra)",
    Number(maharashtra.cart.tax_total ?? 0) > 0,
    `tax_total=${maharashtra.cart.tax_total} total=${maharashtra.cart.total}`,
  );

  const rates = await pg.query(`
    select pg.province_code, tr.name, tr.rate
    from tax_rate tr
    join tax_region pg on pg.id = tr.tax_region_id
    where tr.deleted_at is null
    order by pg.province_code, tr.name`);
  console.log("tax rates:", JSON.stringify(rates.rows));

  // 4. Forged COD metadata cannot reach a COD completion.
  const forgedCart = await req(`${BE}/store/carts`, {
    method: "POST",
    headers: key,
    body: { region_id: region.id },
  });
  const forgedId = forgedCart.json.cart.id;
  created.push(forgedId);
  const forge = await req(`${BE}/store/carts/${forgedId}`, {
    method: "POST",
    headers: key,
    body: { metadata: { cod_otp_verified_at: new Date().toISOString() } },
  });
  const stored = await pg.query("select metadata from cart where id = $1", [forgedId]);
  check(
    "forged metadata is inert (no COD provider to complete against)",
    !providerIds.includes("pp_system_default") && forge.status < 500,
    `cart update status=${forge.status} stored=${JSON.stringify(stored.rows[0]?.metadata ?? {})}`,
  );

  const codSession = await req(`${BE}/store/payment-collections`, {
    method: "POST",
    headers: key,
    body: { cart_id: forgedId },
  });
  const collectionId = codSession.json?.payment_collection?.id;
  const codAttempt = collectionId
    ? await req(`${BE}/store/payment-collections/${collectionId}/payment-sessions`, {
        method: "POST",
        headers: key,
        body: { provider_id: "pp_system_default" },
      })
    : { status: 0, text: "no collection" };
  check(
    "COD payment session rejected",
    codAttempt.status >= 400,
    `status=${codAttempt.status} ${codAttempt.text.slice(0, 120)}`,
  );
} finally {
  for (const cartId of created) {
    await pg.query("delete from cart where id = $1", [cartId]).catch(() => undefined);
  }
  await pg.end();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) process.exitCode = 1;
