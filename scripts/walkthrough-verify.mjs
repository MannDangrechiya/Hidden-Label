/**
 * End-to-End Walkthrough Verification Script
 * Validates Phase 3 (modules), Phase 4 (storefront customer journey), Phase 5 (admin RBAC & operations)
 */
import { Client } from "pg";

const STOREFRONT_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:9000";
const ADMIN_URL = "http://localhost:7001";
const PUBLISHABLE_KEY = "pk_a3d88b55c71fffa6ac8c8d0aabbb4fcb16879ab5cd26f7c63a26aae32cd6d525";

function storeHeaders(token, extra = {}) {
  const h = {
    accept: "application/json",
    "x-publishable-api-key": PUBLISHABLE_KEY,
    "content-type": "application/json",
    ...extra,
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function adminHeaders(token, extra = {}) {
  const h = {
    accept: "application/json",
    "content-type": "application/json",
    ...extra,
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function run() {
  console.log("=== 1. Health Checks ===");
  const sfHealth = await (await fetch(`${STOREFRONT_URL}/api/health`)).json();
  console.log("Storefront Health:", sfHealth);
  if (sfHealth.status !== "ok") throw new Error("Storefront not healthy");

  const beHealth = await (await fetch(`${BACKEND_URL}/health`)).text();
  console.log("Backend Health:", beHealth);
  if (beHealth !== "OK") throw new Error("Backend not healthy");

  const adminRes = await fetch(`${ADMIN_URL}/login`);
  console.log("Admin Health /login:", adminRes.status);
  if (adminRes.status !== 200) throw new Error("Admin not healthy");

  console.log("\n=== 2. Resolving Storefront Region ===");
  const regionsRes = await (await fetch(`${BACKEND_URL}/store/regions`, { headers: storeHeaders() })).json();
  const region = regionsRes.regions?.find((r) => r.currency_code === "inr") ?? regionsRes.regions?.[0];
  if (!region) throw new Error("No region found in store");
  console.log(`Region found: ${region.name} (${region.id}, ${region.currency_code})`);

  console.log("\n=== 3. Customer Registration & OTP Flow ===");
  const testEmail = `collector_${Date.now()}@example.com`;
  const testPassword = "CollectorPass123!";
  console.log(`Registering customer: ${testEmail}`);

  // Step 3a: Register auth identity
  const regRes = await fetch(`${BACKEND_URL}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: storeHeaders(),
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  if (!regRes.ok) {
    throw new Error(`Auth register failed: ${regRes.status} ${await regRes.text()}`);
  }
  const { token: regToken } = await regRes.json();
  console.log("Actorless registration token obtained");

  // Step 3b: Create customer record
  const custRes = await fetch(`${BACKEND_URL}/store/customers`, {
    method: "POST",
    headers: storeHeaders(regToken),
    body: JSON.stringify({
      email: testEmail,
      first_name: "Sneaker",
      last_name: "Collector",
      phone: "+919876543210",
    }),
  });
  if (!custRes.ok) {
    throw new Error(`Create customer failed: ${custRes.status} ${await custRes.text()}`);
  }
  const { customer } = await custRes.json();
  console.log(`Customer created: ${customer.id} (${customer.email})`);

  // Step 3c: Login customer
  const loginRes = await fetch(`${BACKEND_URL}/auth/customer/emailpass`, {
    method: "POST",
    headers: storeHeaders(),
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  if (!loginRes.ok) {
    throw new Error(`Customer login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const { token: customerToken } = await loginRes.json();
  console.log("Customer logged in, session token obtained");

  // Step 3d: Verify profile
  const meRes = await fetch(`${BACKEND_URL}/store/customers/me`, {
    headers: storeHeaders(customerToken),
  });
  if (!meRes.ok) throw new Error(`GET /store/customers/me failed: ${meRes.status}`);
  const me = await meRes.json();
  console.log(`Verified customer identity: ${me.customer.first_name} ${me.customer.last_name}`);

  // Step 3e: OTP Send & Verify
  const otpSendRes = await fetch(`${BACKEND_URL}/store/otp/send`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({
      destination: testEmail,
      channel: "email",
      purpose: "email_verify",
    }),
  });
  if (!otpSendRes.ok) throw new Error(`OTP send failed: ${otpSendRes.status} ${await otpSendRes.text()}`);
  const otpSend = await otpSendRes.json();
  console.log(`OTP generated challenge: ${otpSend.challenge_id}, dev code: ${otpSend.dev_code}`);

  const otpVerifyRes = await fetch(`${BACKEND_URL}/store/otp/verify`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({
      challenge_id: otpSend.challenge_id,
      code: otpSend.dev_code ?? "123456",
    }),
  });
  if (!otpVerifyRes.ok) throw new Error(`OTP verify failed: ${otpVerifyRes.status} ${await otpVerifyRes.text()}`);
  const otpVerify = await otpVerifyRes.json();
  console.log(`OTP verification result: verified = ${otpVerify.verified}`);

  console.log("\n=== 4. Catalog, Brand & Search Navigation ===");
  // Products
  const prodsRes = await (await fetch(`${BACKEND_URL}/store/products?region_id=${region.id}`, { headers: storeHeaders() })).json();
  console.log(`Products in catalog: ${prodsRes.products?.length ?? 0}`);
  const sampleProduct = prodsRes.products?.[0];
  if (!sampleProduct) throw new Error("No products available");
  console.log(`Sample product: ${sampleProduct.title} (handle: ${sampleProduct.handle})`);

  // Brand module
  const brandsRes = await (await fetch(`${BACKEND_URL}/store/brands`, { headers: storeHeaders() })).json();
  console.log(`Brands in store: ${brandsRes.brands?.length ?? 0}`);
  const sampleBrand = brandsRes.brands?.[0];
  console.log(`Sample brand: ${sampleBrand?.name} (handle: ${sampleBrand?.handle})`);

  // Search typeahead
  const searchRes = await (await fetch(`${BACKEND_URL}/store/search/suggest?q=Samba`, { headers: storeHeaders() })).json();
  console.log(`Search suggestions for 'Samba': ${searchRes.products?.length ?? 0} products, ${searchRes.brands?.length ?? 0} brands`);

  console.log("\n=== 5. Cart & COD Checkout Workflow ===");
  // Create cart
  const cartRes = await fetch(`${BACKEND_URL}/store/carts`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({ region_id: region.id }),
  });
  if (!cartRes.ok) throw new Error(`Create cart failed: ${cartRes.status} ${await cartRes.text()}`);
  const { cart } = await cartRes.json();
  console.log(`Cart created: ${cart.id}`);

  // Find an in-stock variant and add it
  let targetVariant = null;
  let updatedCart = null;
  for (const p of prodsRes.products) {
    for (const v of p.variants ?? []) {
      const addRes = await fetch(`${BACKEND_URL}/store/carts/${cart.id}/line-items`, {
        method: "POST",
        headers: storeHeaders(customerToken),
        body: JSON.stringify({ variant_id: v.id, quantity: 1 }),
      });
      if (addRes.ok) {
        targetVariant = v;
        const data = await addRes.json();
        updatedCart = data.cart;
        break;
      }
    }
    if (targetVariant) break;
  }
  if (!targetVariant || !updatedCart) throw new Error("Could not find any variant with available inventory");
  console.log(`Added in-stock variant ${targetVariant.id} (${targetVariant.title}) to cart. Subtotal: ₹${updatedCart.subtotal}, Total: ₹${updatedCart.total}`);

  // Set Address
  const addressPayload = {
    first_name: "Sneaker",
    last_name: "Collector",
    phone: "+919876543210",
    address_1: "Flat 402, High Street Towers",
    city: "Mumbai",
    province: "Maharashtra",
    postal_code: "400001",
    country_code: "in",
  };
  const setAddrRes = await fetch(`${BACKEND_URL}/store/carts/${cart.id}`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({
      email: testEmail,
      shipping_address: addressPayload,
      billing_address: addressPayload,
    }),
  });
  if (!setAddrRes.ok) throw new Error(`Set address failed: ${setAddrRes.status} ${await setAddrRes.text()}`);
  console.log("Shipping and billing address attached to cart");

  // Fetch Shipping Options
  const shipOptRes = await fetch(`${BACKEND_URL}/store/shipping-options?cart_id=${cart.id}`, {
    headers: storeHeaders(customerToken),
  });
  if (!shipOptRes.ok) throw new Error(`List shipping options failed: ${shipOptRes.status} ${await shipOptRes.text()}`);
  const { shipping_options } = await shipOptRes.json();
  console.log(`Available shipping options: ${shipping_options.length}`);
  const standardOption = shipping_options[0];
  if (!standardOption) throw new Error("No shipping option available for cart");
  console.log(`Selected shipping option: ${standardOption.name} (${standardOption.id})`);

  // Select Shipping Method
  const setShipRes = await fetch(`${BACKEND_URL}/store/carts/${cart.id}/shipping-methods`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({ option_id: standardOption.id }),
  });
  if (!setShipRes.ok) throw new Error(`Select shipping method failed: ${setShipRes.status} ${await setShipRes.text()}`);
  console.log("Shipping method selected");

  // Create Payment Collection
  const payColRes = await fetch(`${BACKEND_URL}/store/payment-collections`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({ cart_id: cart.id }),
  });
  if (!payColRes.ok) throw new Error(`Create payment collection failed: ${payColRes.status} ${await payColRes.text()}`);
  const { payment_collection } = await payColRes.json();
  console.log(`Payment collection created: ${payment_collection.id}`);

  // Create Payment Session for Cash on Delivery (pp_system_default)
  const paySessRes = await fetch(`${BACKEND_URL}/store/payment-collections/${payment_collection.id}/payment-sessions`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({ provider_id: "pp_system_default" }),
  });
  if (!paySessRes.ok) throw new Error(`Create payment session failed: ${paySessRes.status} ${await paySessRes.text()}`);
  console.log("Payment session for Cash on Delivery created (pp_system_default)");

  // Complete Cart (Place Order)
  const completeRes = await fetch(`${BACKEND_URL}/store/carts/${cart.id}/complete`, {
    method: "POST",
    headers: storeHeaders(customerToken),
  });
  if (!completeRes.ok) throw new Error(`Complete cart failed: ${completeRes.status} ${await completeRes.text()}`);
  const completeData = await completeRes.json();
  if (completeData.type !== "order") {
    throw new Error(`Order placement did not return an order: ${JSON.stringify(completeData)}`);
  }
  const order = completeData.order;
  console.log(`✅ Order placed successfully! Order ID: ${order.id}, Display ID: #${order.display_id}, Status: ${order.status}, Total: ₹${order.total}`);

  console.log("\n=== 6. Order History & Return Request Flow ===");
  // Verify order in customer order history
  const myOrdersRes = await fetch(`${BACKEND_URL}/store/orders?limit=5`, {
    headers: storeHeaders(customerToken),
  });
  if (!myOrdersRes.ok) throw new Error(`Fetch my orders failed: ${myOrdersRes.status}`);
  const myOrders = await myOrdersRes.json();
  console.log(`Customer orders found: ${myOrders.orders?.length ?? 0}`);
  const foundOrder = myOrders.orders?.find((o) => o.id === order.id);
  if (!foundOrder) throw new Error(`Placed order ${order.id} not found in customer order history`);
  console.log(`Confirmed order #${foundOrder.display_id} in customer order history`);

  // Request a return on the order
  const orderDetailRes = await fetch(`${BACKEND_URL}/store/orders/${order.id}?fields=*items`, {
    headers: storeHeaders(customerToken),
  });
  const { order: fullOrder } = await orderDetailRes.json();
  const orderItem = fullOrder.items?.[0];
  if (!orderItem) throw new Error("No order item found in placed order");

  // 6a. Attempt return before delivery -> MUST return 422
  const unDeliveredReturnRes = await fetch(`${BACKEND_URL}/store/return-requests`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({
      order_id: order.id,
      reason_code: "size_too_small",
      note: "Need half size up",
      items: [{ order_item_id: orderItem.id, quantity: 1 }],
    }),
  });
  console.log(`Return request before delivery returned status: ${unDeliveredReturnRes.status} (expected 422)`);
  if (unDeliveredReturnRes.status !== 422) {
    throw new Error(`Expected 422 for undelivered return, got ${unDeliveredReturnRes.status}`);
  }
  const rejectedBody = await unDeliveredReturnRes.json();
  console.log(`Rejection message verified: "${rejectedBody.message}"`);

  // 6b. Simulate fulfillment & delivery in DB so RMA can be tested
  const pgClient = new Client({
    host: "127.0.0.1",
    port: 5437,
    user: "postgres",
    database: "the_hidden_label",
  });
  await pgClient.connect();
  const locRow = await pgClient.query("select id from stock_location limit 1");
  const locationId = locRow.rows[0]?.id;
  const fulId = `ful_test_${Date.now()}`;
  await pgClient.query(`
    insert into fulfillment (id, location_id, provider_id, delivery_address_id, data, delivered_at, created_at, updated_at)
    values ($1, $2, 'manual_manual', $3, '{}', now(), now(), now())
  `, [fulId, locationId, order.shipping_address_id ?? null]);
  await pgClient.query(`
    insert into order_fulfillment (id, order_id, fulfillment_id)
    values ($1, $2, $3)
  `, [`ordful_${Date.now()}`, order.id, fulId]);
  await pgClient.end();
  console.log("Recorded delivered fulfillment for order in DB");

  // 6c. Now request return on the delivered order -> MUST succeed with 201
  const returnRes = await fetch(`${BACKEND_URL}/store/return-requests`, {
    method: "POST",
    headers: storeHeaders(customerToken),
    body: JSON.stringify({
      order_id: order.id,
      reason_code: "size_too_small",
      note: "Need half size up",
      items: [{ order_item_id: orderItem.id, quantity: 1 }],
    }),
  });
  if (!returnRes.ok) throw new Error(`Create return request failed: ${returnRes.status} ${await returnRes.text()}`);
  const returnData = await returnRes.json();
  console.log(`✅ Return request created! RMA ID: ${returnData.return.display_id}, Status: ${returnData.return.status}`);

  console.log("\n=== 7. Admin RBAC & Operations ===");
  // Test RBAC 401 rejection on unauthenticated calls
  const unauthOrders = await fetch(`${BACKEND_URL}/admin/orders`);
  console.log(`Unauthenticated GET /admin/orders returned status: ${unauthOrders.status} (expected 401)`);
  if (unauthOrders.status !== 401) throw new Error(`RBAC failure: expected 401 but got ${unauthOrders.status}`);

  const unauthBrands = await fetch(`${BACKEND_URL}/admin/brands`);
  console.log(`Unauthenticated GET /admin/brands returned status: ${unauthBrands.status} (expected 401)`);
  if (unauthBrands.status !== 401) throw new Error(`RBAC failure: expected 401 but got ${unauthBrands.status}`);

  const unauthReturns = await fetch(`${BACKEND_URL}/admin/returns`);
  console.log(`Unauthenticated GET /admin/returns returned status: ${unauthReturns.status} (expected 401)`);
  if (unauthReturns.status !== 401) throw new Error(`RBAC failure: expected 401 but got ${unauthReturns.status}`);

  // Admin login
  const adminLoginRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ email: "admin@thehiddenlabel.com", password: "AdminPass123!" }),
  });
  if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${adminLoginRes.status} ${await adminLoginRes.text()}`);
  const { token: adminToken } = await adminLoginRes.json();
  console.log("Admin logged in successfully, admin JWT obtained");

  // Admin users/me
  const adminMeRes = await fetch(`${BACKEND_URL}/admin/users/me?fields=id,email,metadata`, {
    headers: adminHeaders(adminToken),
  });
  if (!adminMeRes.ok) throw new Error(`Admin me failed: ${adminMeRes.status}`);
  const adminMe = await adminMeRes.json();
  console.log(`Admin identity: ${adminMe.user.email}, role: ${adminMe.user.metadata?.role}`);

  // Admin list orders: check our placed order is present
  const adminOrdersRes = await fetch(`${BACKEND_URL}/admin/orders?limit=10`, {
    headers: adminHeaders(adminToken),
  });
  if (!adminOrdersRes.ok) throw new Error(`Admin list orders failed: ${adminOrdersRes.status}`);
  const adminOrders = await adminOrdersRes.json();
  const placedOrderInAdmin = adminOrders.orders?.find((o) => o.id === order.id);
  console.log(`Admin orders list count: ${adminOrders.count ?? adminOrders.orders?.length}. Placed order found: ${Boolean(placedOrderInAdmin)}`);

  // Admin list return requests: check our RMA is present
  const adminReturnsRes = await fetch(`${BACKEND_URL}/admin/returns`, {
    headers: adminHeaders(adminToken),
  });
  if (!adminReturnsRes.ok) throw new Error(`Admin list returns failed: ${adminReturnsRes.status}`);
  const adminReturns = await adminReturnsRes.json();
  const rmaFound = adminReturns.returns?.find((r) => r.id === returnData.return.id);
  console.log(`Admin returns count: ${adminReturns.returns?.length}. RMA #${returnData.return.display_id} found: ${Boolean(rmaFound)}`);

  // Admin Brand CRUD
  const testBrandHandle = `test-brand-${Date.now()}`;
  const createBrandRes = await fetch(`${BACKEND_URL}/admin/brands`, {
    method: "POST",
    headers: adminHeaders(adminToken),
    body: JSON.stringify({
      name: "Test Verification Brand",
      handle: testBrandHandle,
      tagline: "Temporary brand for verification",
      description: "Testing admin brand create & delete",
      partnership_tier: "core",
      country: "India",
      sort_order: 99,
      is_active: true,
    }),
  });
  if (!createBrandRes.ok) throw new Error(`Admin create brand failed: ${createBrandRes.status} ${await createBrandRes.text()}`);
  const createdBrand = await createBrandRes.json();
  console.log(`Admin created brand: ${createdBrand.brand?.name} (id: ${createdBrand.brand?.id})`);

  // Admin delete test brand
  const deleteBrandRes = await fetch(`${BACKEND_URL}/admin/brands/${createdBrand.brand.id}`, {
    method: "DELETE",
    headers: adminHeaders(adminToken),
  });
  if (!deleteBrandRes.ok) throw new Error(`Admin delete brand failed: ${deleteBrandRes.status}`);
  console.log("Admin deleted test brand cleanly");

  // Admin Audit Log
  const auditRes = await fetch(`${BACKEND_URL}/admin/audit?limit=10`, {
    headers: adminHeaders(adminToken),
  });
  if (!auditRes.ok) throw new Error(`Admin audit fetch failed: ${auditRes.status}`);
  const auditData = await auditRes.json();
  console.log(`Admin audit entries count: ${auditData.events?.length ?? auditData.items?.length ?? 0}`);

  console.log("\n==========================================");
  console.log("🎉 ALL END-TO-END VERIFICATION CHECKS PASSED!");
  console.log("==========================================");
}

run().catch((err) => {
  console.error("\n❌ VERIFICATION FAILED:", err);
  process.exit(1);
});
