/**
 * Focused verification of GAP-SEC-02 (remediation Phase 1).
 *
 * 1. A public cart write tries to forge `metadata.cod_otp_verified_at`.
 * 2. The stored cart metadata must not contain it (the guard strips reserved keys).
 * 3. Completing a COD cart without a server proof must be rejected with the COD message.
 * 4. With a `cod_verification` row (what /store/carts/:id/verify-cod writes after a real OTP),
 *    the COD gate must no longer be the reason for failure.
 *
 * Run with the backend on :9000 and PostgreSQL on :5437.
 */
import { Client } from "pg";
import fs from "node:fs";

const BE = "http://localhost:9000";
const PK = /^\s*MEDUSA_PUBLISHABLE_KEY=(.+)$/m.exec(
  fs.readFileSync("apps/storefront/.env", "utf8"),
)[1].trim();

const PG = { host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" };

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
    /* non-JSON error body */
  }
  return { status: res.status, text, json };
}

const key = { "x-publishable-api-key": PK };
const pg = new Client(PG);
await pg.connect();

const created = [];
try {
  const regions = await req(`${BE}/store/regions`, { headers: key });
  const region = regions.json.regions[0];

  const cartRes = await req(`${BE}/store/carts`, {
    method: "POST",
    headers: key,
    body: { region_id: region.id },
  });
  const cartId = cartRes.json.cart.id;
  created.push(cartId);

  // 1-2: forge through the public store API and inspect what was stored.
  const forged = await req(`${BE}/store/carts/${cartId}`, {
    method: "POST",
    headers: key,
    body: { metadata: { cod_otp_verified_at: new Date().toISOString() } },
  });
  const stored = await pg.query("select metadata from cart where id = $1", [cartId]);
  const storedMeta = stored.rows[0]?.metadata ?? {};

  // Link a COD payment session (this is what a checkout does before completion).
  const stamp = Date.now();
  const colId = `pc_verify_${stamp}`;
  const linkId = `cpc_verify_${stamp}`;
  const sessId = `ps_verify_${stamp}`;
  const raw = JSON.stringify({ value: "100", precision: 20 });

  await pg.query(
    `insert into payment_collection (id, currency_code, amount, raw_amount, status, created_at, updated_at)
     values ($1, 'inr', 100, $2, 'not_paid', now(), now())`,
    [colId, raw],
  );
  await pg.query(
    `insert into cart_payment_collection (id, cart_id, payment_collection_id, created_at, updated_at)
     values ($1, $2, $3, now(), now())`,
    [linkId, cartId, colId],
  );
  await pg.query(
    `insert into payment_session (id, currency_code, amount, raw_amount, provider_id, data, status, payment_collection_id, created_at, updated_at)
     values ($1, 'inr', 100, $2, 'pp_system_default', '{}'::jsonb, 'pending', $3, now(), now())`,
    [sessId, raw, colId],
  );

  // 3: completion without proof.
  const noProof = await req(`${BE}/store/carts/${cartId}/complete`, { method: "POST", headers: key });

  // 4: insert the server-side proof and retry.
  const proofId = `codv_verify_${stamp}`;
  await pg.query(
    `insert into cod_verification (id, cart_id, phone, challenge_id, verified_at, created_at, updated_at)
     values ($1, $2, '+919876543210', 'otp_verify', now(), now(), now())`,
    [proofId, cartId],
  );
  const withProof = await req(`${BE}/store/carts/${cartId}/complete`, { method: "POST", headers: key });

  const forgeryBlocked =
    forged.status === 200 &&
    !("cod_otp_verified_at" in storedMeta) &&
    !("cod_otp_verified_phone" in storedMeta);
  const completionBlocked =
    noProof.status === 400 && /OTP verification/i.test(noProof.json?.message ?? "");
  const gateOpensWithProof = !/OTP verification/i.test(withProof.json?.message ?? noProof.text ?? "");

  console.log("Forged cart write status:", forged.status);
  console.log("Stored cart metadata:", JSON.stringify(storedMeta));
  console.log("Completion without proof:", noProof.status, noProof.json?.message ?? noProof.text.slice(0, 120));
  console.log("Completion with server proof:", withProof.status, withProof.json?.message ?? withProof.text.slice(0, 120));
  console.log("RESULT forgery_blocked:", forgeryBlocked);
  console.log("RESULT completion_blocked:", completionBlocked);
  console.log("RESULT gate_opens_with_server_proof:", gateOpensWithProof);

  if (!forgeryBlocked || !completionBlocked || !gateOpensWithProof) process.exitCode = 1;
} finally {
  for (const cartId of created) {
    await pg
      .query(
        "delete from cod_verification where cart_id = $1; delete from payment_session where payment_collection_id in (select payment_collection_id from cart_payment_collection where cart_id = $1); delete from cart_payment_collection where cart_id = $1; delete from payment_collection where id in (select payment_collection_id from cart_payment_collection where cart_id = $1); delete from cart where id = $1",
        [cartId],
      )
      .catch(() => undefined);
  }
  await pg.end();
}
