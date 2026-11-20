import { Client } from "pg";
import fs from "node:fs";

const BE = "http://localhost:9000";
const PG = { host: "127.0.0.1", port: 5437, user: "postgres", database: "the_hidden_label" };

const envText = fs.readFileSync("apps/storefront/.env", "utf8");
const PK = /^\s*MEDUSA_PUBLISHABLE_KEY=(.+)$/m.exec(envText)[1].trim();

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

async function run() {
  const pg = new Client(PG);
  await pg.connect();
  const runId = `gate_${Date.now()}`;
  console.log(`Starting Independent Release Gate Workflow Verification: ${runId}`);

  const evidence = [];

  function record(testId, name, passed, details, dbVerified, dbDetails) {
    const item = {
      testId,
      name,
      status: passed ? (dbVerified ? "PASS" : "BLOCKED") : "FAIL",
      details,
      dbVerified,
      dbDetails,
    };
    evidence.push(item);
    console.log(`[${item.status}] ${testId} - ${name} | DB: ${dbVerified ? "VERIFIED" : "UNVERIFIED"}`);
    if (!passed || !dbVerified) {
      console.log(`   Details: ${JSON.stringify(details)} | DB: ${JSON.stringify(dbDetails)}`);
    }
  }

  // 1. Customer registration and login
  const testEmail = `${runId}.customer@example.com`;
  const testPass = "GatePass123!";
  const regRes = await req(`${BE}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { email: testEmail, password: testPass },
  });
  const regToken = regRes.json?.token;
  const custRes = await req(`${BE}/store/customers`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${regToken}` },
    body: { email: testEmail, first_name: "Gate", last_name: "Tester", phone: "+919876543210" },
  });
  const custId = custRes.json?.customer?.id;

  const loginRes = await req(`${BE}/auth/customer/emailpass`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK },
    body: { email: testEmail, password: testPass },
  });
  const authToken = loginRes.json?.token;

  // Verify DB
  const dbCust = await pg.query("SELECT id, email, first_name FROM customer WHERE id = $1", [custId]);
  record(
    "WF-CUST-01",
    "Customer registration and login",
    regRes.status === 200 && custRes.status === 200 && loginRes.status === 200 && !!authToken,
    { regStatus: regRes.status, custId, loginStatus: loginRes.status },
    dbCust.rows.length === 1 && dbCust.rows[0].email === testEmail,
    dbCust.rows[0]
  );

  // 2. Product browsing and variant selection
  const prodRes = await req(`${BE}/store/products?limit=5`, {
    headers: { "x-publishable-api-key": PK },
  });
  const product = prodRes.json?.products?.[0];
  const variant = product?.variants?.[0];
  const dbProd = await pg.query("SELECT id, title, handle FROM product WHERE id = $1", [product?.id]);
  record(
    "WF-PROD-01",
    "Product browsing and variant selection",
    prodRes.status === 200 && !!product && !!variant,
    { productId: product?.id, variantId: variant?.id, title: product?.title },
    dbProd.rows.length === 1 && dbProd.rows[0].handle === product?.handle,
    dbProd.rows[0]
  );

  // 3. Promotion creation & redemption
  const promoCode = `GATE${Date.now()}`;
  const adminLogin = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    body: { email: "admin@thehiddenlabel.com", password: "AdminPass123!" },
  });
  const adminToken = adminLogin.json?.token;
  const adminHeaders = { authorization: `Bearer ${adminToken}` };

  const createPromo = await req(`${BE}/admin/promotions`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      code: promoCode,
      type: "standard",
      is_automatic: false,
      application_method: {
        type: "percentage",
        value: 10,
        currency_code: "inr",
        target_type: "order",
        allocation: "across",
      },
      rules: [],
    },
  });
  const promoId = createPromo.json?.promotion?.id;
  const dbPromo = await pg.query("SELECT id, code, type FROM promotion WHERE code = $1", [promoCode]);
  record(
    "WF-PROMO-01",
    "Admin Promotion Creation",
    createPromo.status === 200 && !!promoId,
    { status: createPromo.status, promoId, code: promoCode },
    dbPromo.rows.length === 1 && dbPromo.rows[0].code === promoCode,
    dbPromo.rows[0]
  );

  // 4. Cart and checkout with promotion redemption
  const regDb = await pg.query("SELECT id FROM region WHERE currency_code = 'inr' LIMIT 1");
  const regionId = regDb.rows[0]?.id;

  const inStockDb = await pg.query(`
    select pv.id variant_id, pv.title variant_title, p.handle, p.title product_title
    from product_variant pv
    join product p on p.id = pv.product_id
    left join inventory_item ii on ii.sku = pv.sku
    left join inventory_level il on il.inventory_item_id = ii.id
    where p.deleted_at is null
    group by pv.id, pv.title, p.handle, p.title
    having coalesce(sum(il.stocked_quantity - il.reserved_quantity), 0) >= 5
    order by p.title limit 1`);
  const stockVariantId = inStockDb.rows[0]?.variant_id;

  const cartRes = await req(`${BE}/store/carts`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { region_id: regionId },
  });
  const cartId = cartRes.json?.cart?.id;

  const lineRes = await req(`${BE}/store/carts/${cartId}/line-items`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { variant_id: stockVariantId, quantity: 1 },
  });

  // Apply promo code
  const applyPromo = await req(`${BE}/store/carts/${cartId}/promotions`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { promo_codes: [promoCode] },
  });

  const address = {
    first_name: "Gate",
    last_name: "Tester",
    phone: "+919876543210",
    address_1: "404 Gate Tower",
    city: "Ahmedabad",
    province: "Gujarat",
    postal_code: "380054",
    country_code: "in",
  };
  await req(`${BE}/store/carts/${cartId}`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { email: testEmail, shipping_address: address, billing_address: address },
  });

  const soRes = await req(`${BE}/store/shipping-options?cart_id=${cartId}`, {
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
  });
  const soId = soRes.json?.shipping_options?.[0]?.id;
  await req(`${BE}/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { option_id: soId },
  });

  const pcRes = await req(`${BE}/store/payment-collections`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { cart_id: cartId },
  });
  const pcId = pcRes.json?.payment_collection?.id;
  await req(`${BE}/store/payment-collections/${pcId}/payment-sessions`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { provider_id: "pp_system_default" },
  });

  // Check DB cart & promotion
  const dbCart = await pg.query("SELECT id, currency_code, email, metadata FROM cart WHERE id = $1", [cartId]);
  record(
    "WF-CART-01",
    "Cart creation, line items, address, promo apply",
    cartRes.status === 200 && lineRes.status === 200 && applyPromo.status === 200,
    { cartId, total: lineRes.json?.cart?.total, promoStatus: applyPromo.status },
    dbCart.rows.length === 1,
    dbCart.rows[0]
  );

  // 5. Order Placement (with valid server OTP timestamp set)
  await pg.query(
    "UPDATE cart SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cod_otp_verified_at', now()::text) WHERE id = $1",
    [cartId]
  );
  const completeRes = await req(`${BE}/store/carts/${cartId}/complete`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
  });
  const order = completeRes.json?.order;
  const orderId = order?.id;

  const dbOrder = await pg.query('SELECT id, display_id, status, email FROM "order" WHERE id = $1', [orderId]);
  record(
    "WF-ORD-01",
    "Order Placement (COD)",
    completeRes.status === 200 && !!orderId,
    { orderId, displayId: order?.display_id, status: order?.status },
    dbOrder.rows.length === 1 && dbOrder.rows[0].status === "pending",
    dbOrder.rows[0]
  );

  // 6. Admin fulfilment
  const fulfilRes = await req(`${BE}/admin/orders/${orderId}/actions`, {
    method: "POST",
    headers: adminHeaders,
    body: { action: "fulfill" },
  });
  const dbFulfil = await pg.query(
    "SELECT f.id, f.delivered_at, of.order_id FROM fulfillment f JOIN order_fulfillment of ON of.fulfillment_id = f.id WHERE of.order_id = $1",
    [orderId]
  );
  record(
    "WF-FUL-01",
    "Admin Order Fulfilment",
    fulfilRes.status === 200,
    { status: fulfilRes.status, orderStatus: fulfilRes.json?.order?.status },
    dbFulfil.rows.length >= 1,
    dbFulfil.rows[0]
  );

  // 7. Shipment creation and tracking status
  const shipRes = await req(`${BE}/admin/shipments`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      order_id: orderId,
      courier: "Shiprocket Express",
    },
  });
  const shipId = shipRes.json?.shipment?.id;
  if (shipId) {
    await req(`${BE}/admin/shipments/${shipId}`, {
      method: "POST",
      headers: adminHeaders,
      body: {
        status: "shipped",
        awb: `AWB${Date.now()}`,
        courier: "Shiprocket Express",
      },
    });
  }
  const dbShipment = await pg.query(
    "SELECT id, order_id, awb, status, courier FROM shipment WHERE order_id = $1",
    [orderId]
  );
  record(
    "WF-SHIP-01",
    "Shipment and tracking status creation",
    shipRes.status === 201 || shipRes.status === 200,
    { status: shipRes.status, shipment: shipRes.json },
    dbShipment.rows.length >= 1,
    dbShipment.rows[0]
  );

  // 8. Return request, approval, receipt, refund
  // Mark delivered in DB first
  await pg.query(
    "UPDATE fulfillment f SET delivered_at = now() FROM order_fulfillment of WHERE of.fulfillment_id = f.id AND of.order_id = $1",
    [orderId]
  );

  const orderItems = await req(`${BE}/store/orders/${orderId}?fields=*items`, {
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
  });
  const orderLineId = orderItems.json?.order?.items?.[0]?.id;

  const returnReq = await req(`${BE}/store/return-requests`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: {
      order_id: orderId,
      reason_code: "wrong_size",
      note: "Release Gate Return Test",
      items: [{ order_item_id: orderLineId, quantity: 1 }],
    },
  });
  const returnId = returnReq.json?.return?.id;

  const dbReturn = await pg.query("SELECT id, display_id, status FROM return_request WHERE id = $1", [returnId]);
  record(
    "WF-RET-01",
    "Customer Return Request Creation",
    returnReq.status === 201 && !!returnId,
    { returnId, displayId: returnReq.json?.return?.display_id },
    dbReturn.rows.length === 1 && dbReturn.rows[0].status === "requested",
    dbReturn.rows[0]
  );

  // Admin return approval
  const approveRes = await req(`${BE}/admin/returns/${returnId}`, {
    method: "POST",
    headers: adminHeaders,
    body: { action: "approve" },
  });
  const dbApprove = await pg.query("SELECT id, status FROM return_request WHERE id = $1", [returnId]);
  record(
    "WF-RET-02",
    "Admin Return Approval",
    approveRes.status === 200,
    { status: approveRes.status, returnStatus: approveRes.json?.return?.status },
    dbApprove.rows.length === 1 && dbApprove.rows[0].status === "approved",
    dbApprove.rows[0]
  );

  // 9. Consignment Ask & Delisting
  const askRes = await req(`${BE}/store/resale/asks`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: {
      variant_id: stockVariantId,
      ask_price: 25000,
      condition_grade: "deadstock",
      box_condition: "perfect",
    },
  });
  const askId = askRes.json?.ask?.id;
  const dbAskBefore = await pg.query("SELECT id, status, ask_price FROM resale_ask WHERE id = $1", [askId]);

  // Delist
  const delistRes = await req(`${BE}/store/resale/asks/${askId}`, {
    method: "DELETE",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
  });
  const dbAskAfter = await pg.query("SELECT id, status FROM resale_ask WHERE id = $1", [askId]);
  record(
    "WF-CONSIGN-01",
    "Consignment creation & delisting",
    askRes.status === 201 && (delistRes.status === 200 || delistRes.status === 204),
    { askId, delistStatus: delistRes.status },
    dbAskBefore.rows[0]?.status === "active" && dbAskAfter.rows[0]?.status === "cancelled",
    { before: dbAskBefore.rows[0], after: dbAskAfter.rows[0] }
  );

  // 10. Fit Studio Rules CRUD
  const createRule = await req(`${BE}/admin/fit-rules`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      silhouette_name: `ReleaseGateRule_${Date.now()}`,
      fit_tendency: "runs_small",
      recommended_size_delta: 0.5,
      width_profile: "regular",
      guidance_text: "Release gate audit fixture",
    },
  });
  const ruleId = createRule.json?.rule?.id;
  const dbRule = await pg.query("SELECT id, silhouette_name, fit_tendency FROM silhouette_fit_rule WHERE id = $1", [ruleId]);

  const deleteRule = await req(`${BE}/admin/fit-rules/${ruleId}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  const dbRuleAfter = await pg.query("SELECT id, deleted_at FROM silhouette_fit_rule WHERE id = $1", [ruleId]);
  record(
    "WF-FIT-01",
    "Fit Studio Rule CRUD (Create & Delete)",
    createRule.status === 201 && deleteRule.status === 200,
    { createStatus: createRule.status, deleteStatus: deleteRule.status, ruleId },
    dbRule.rows.length === 1 && dbRuleAfter.rows[0]?.deleted_at !== null,
    { before: dbRule.rows[0], afterDeletedAt: dbRuleAfter.rows[0]?.deleted_at }
  );

  // 11. Customer order cancellation
  // Create another order to test cancellation
  const cart2Res = await req(`${BE}/store/carts`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { region_id: regionId },
  });
  const cart2Id = cart2Res.json?.cart?.id;
  await req(`${BE}/store/carts/${cart2Id}/line-items`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { variant_id: stockVariantId, quantity: 1 },
  });
  await req(`${BE}/store/carts/${cart2Id}`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { email: testEmail, shipping_address: address, billing_address: address },
  });
  await req(`${BE}/store/carts/${cart2Id}/shipping-methods`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { option_id: soId },
  });
  const pc2 = await req(`${BE}/store/payment-collections`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { cart_id: cart2Id },
  });
  await req(`${BE}/store/payment-collections/${pc2.json.payment_collection.id}/payment-sessions`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { provider_id: "pp_system_default" },
  });
  await pg.query(
    "UPDATE cart SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cod_otp_verified_at', now()::text) WHERE id = $1",
    [cart2Id]
  );
  const comp2 = await req(`${BE}/store/carts/${cart2Id}/complete`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
  });
  const order2Id = comp2.json?.order?.id;

  // Cancel order as customer
  const cancelRes = await req(`${BE}/store/orders/${order2Id}/cancel`, {
    method: "POST",
    headers: { "x-publishable-api-key": PK, authorization: `Bearer ${authToken}` },
    body: { reason: "Changed mind before dispatch" },
  });
  const dbOrder2 = await pg.query('SELECT id, status, canceled_at FROM "order" WHERE id = $1', [order2Id]);
  record(
    "WF-CANCEL-01",
    "Customer Order Cancellation Before Dispatch",
    cancelRes.status === 200,
    { cancelStatus: cancelRes.status, message: cancelRes.json?.message },
    dbOrder2.rows.length === 1 && dbOrder2.rows[0].status === "canceled",
    dbOrder2.rows[0]
  );

  await pg.end();
}

run().catch(console.error);
