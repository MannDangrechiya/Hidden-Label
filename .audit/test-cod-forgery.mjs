import { Client } from "pg";
import fs from "node:fs";

const BE = "http://localhost:9000";
const envText = fs.readFileSync("apps/storefront/.env", "utf8");
const PK = /^\s*MEDUSA_PUBLISHABLE_KEY=(.+)$/m.exec(envText)[1].trim();

const PG = { host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" };

async function req(url, options = {}) {
  const { method = "GET", headers = {}, body } = options;
  const res = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* response was not JSON */ }
  return { status: res.status, text, json };
}

async function testCodOtpBypass() {
  console.log("=== TESTING CLIENT FORGERY OF cod_otp_verified_at VIA STORE API ===");
  const pg = new Client(PG);
  await pg.connect();

  // Find region
  const regRes = await req(`${BE}/store/regions`, { headers: { "x-publishable-api-key": PK } });
  const region = regRes.json?.regions?.find((x) => x.currency_code === "inr") ?? regRes.json?.regions?.[0];

  // Find in-stock variant
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
    limit 1`);
  const variantId = available.rows[0]?.variant_id;

  console.log("Region:", region.id, "In-Stock Variant:", variantId);

  // 1. Create a cart
  const createCart = await req(`${BE}/store/carts`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { region_id: region.id },
  });
  const cartId = createCart.json?.cart?.id;
  console.log("Created Cart ID:", cartId);

  // 2. Add line item
  const addLine = await req(`${BE}/store/carts/${cartId}/line-items`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { variant_id: variantId, quantity: 1 },
  });
  console.log("Add line item status:", addLine.status);
  if (addLine.status !== 200) {
    console.log("Add line item error:", addLine.text);
    return;
  }

  // 3. Set address
  const address = {
    first_name: "Attacker",
    last_name: "Tester",
    phone: "+919876543210",
    address_1: "123 Fraud Lane",
    city: "Mumbai",
    province: "Maharashtra",
    postal_code: "400001",
    country_code: "in",
  };
  await req(`${BE}/store/carts/${cartId}`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { email: "attacker@example.com", shipping_address: address, billing_address: address },
  });

  // 4. Shipping method
  const shippingOptions = await req(`${BE}/store/shipping-options?cart_id=${cartId}`, {
    headers: { "x-publishable-api-key": PK },
  });
  const soId = shippingOptions.json?.shipping_options?.[0]?.id;
  await req(`${BE}/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { option_id: soId },
  });

  // 5. Payment collection & COD payment session
  const payCol = await req(`${BE}/store/payment-collections`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { cart_id: cartId },
  });
  const payColId = payCol.json?.payment_collection?.id;

  await req(`${BE}/store/payment-collections/${payColId}/payment-sessions`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { provider_id: "pp_system_default" },
  });

  // 6. Direct complete WITHOUT OTP -> Expect 400
  const compNoOtp = await req(`${BE}/store/carts/${cartId}/complete`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
  });
  console.log("Attempt 1 (No OTP) status:", compNoOtp.status, compNoOtp.json?.message);

  // 7. CLIENT FORGERY ATTEMPT:
  // Client makes direct call to POST /store/carts/:id setting metadata: { cod_otp_verified_at: new Date().toISOString() }
  const forgedTimestamp = new Date().toISOString();
  console.log("Injecting forged cod_otp_verified_at via POST /store/carts/" + cartId);
  const forgeUpdate = await req(`${BE}/store/carts/${cartId}`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: {
      metadata: {
        cod_otp_verified_at: forgedTimestamp,
      },
    },
  });
  console.log("Cart update response:", forgeUpdate.status, forgeUpdate.json?.cart?.metadata);

  // Check DB directly
  const dbCart = await pg.query("SELECT id, metadata FROM cart WHERE id = $1", [cartId]);
  console.log("Database cart metadata:", dbCart.rows[0]?.metadata);

  // 8. Attempt order completion with forged OTP metadata
  const compForged = await req(`${BE}/store/carts/${cartId}/complete`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
  });
  console.log("Attempt 2 (FORGED OTP) status:", compForged.status);
  console.log("Attempt 2 order ID:", compForged.json?.order?.id, "display_id:", compForged.json?.order?.display_id);

  if (compForged.json?.order?.id) {
    console.log("🚨 CRITICAL SECURITY VULNERABILITY CONFIRMED: Client forged cod_otp_verified_at and completed order!");
  } else {
    console.log("Order completion blocked:", compForged.text);
  }

  await pg.end();
}

testCodOtpBypass().catch(console.error);
