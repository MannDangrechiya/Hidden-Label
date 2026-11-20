import { Client } from "pg";

const BE = "http://localhost:9000";
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

async function testRoles() {
  const pg = new Client(PG);
  await pg.connect();

  const testEmail = "audit.readonly@thehiddenlabel.com";
  const loginRes = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    body: { email: testEmail, password: "AuditPass123!" },
  });
  const token = loginRes.json?.token;
  if (!token) throw new Error("Could not log in test user");

  const roles = ["readonly", "support", "operations", "manager", "owner"];
  const endpoints = [
    { name: "Orders List", method: "GET", path: "/admin/orders?limit=1" },
    { name: "Customers List", method: "GET", path: "/admin/customers?limit=1" },
    { name: "Users List", method: "GET", path: "/admin/users?limit=1" },
    { name: "Products List", method: "GET", path: "/admin/products?limit=1" },
    { name: "Brands List", method: "GET", path: "/admin/brands?limit=1" },
    { name: "Fit Rules List", method: "GET", path: "/admin/fit-rules?limit=1" },
    { name: "Returns List", method: "GET", path: "/admin/returns?limit=1" },
    { name: "Promotions List", method: "GET", path: "/admin/promotions?limit=1" },
    { name: "Brand Create (POST)", method: "POST", path: "/admin/brands", body: { name: "TestBrand", handle: "test-brand-" + Date.now() } },
    { name: "Inventory Adjust (POST)", method: "POST", path: "/admin/inventory", body: { location_id: "loc_1", inventory_item_id: "inv_1", delta: 1, reason: "stock_count" } },
    { name: "User Create / Invite (POST)", method: "POST", path: "/admin/invites", body: { email: "newstaff@example.com", role: "support" } },
  ];

  const results = {};

  for (const role of roles) {
    await pg.query('UPDATE "user" SET metadata = $1 WHERE email = $2', [JSON.stringify({ role }), testEmail]);
    results[role] = {};

    const headers = { authorization: `Bearer ${token}` };
    for (const ep of endpoints) {
      const res = await req(`${BE}${ep.path}`, {
        method: ep.method,
        headers,
        body: ep.body,
      });
      results[role][`${ep.method} ${ep.path.split("?")[0]}`] = res.status;
    }
  }

  // Restore readonly
  await pg.query('UPDATE "user" SET metadata = $1 WHERE email = $2', [JSON.stringify({ role: "readonly" }), testEmail]);
  await pg.end();

  console.log(JSON.stringify(results, null, 2));
}

testRoles().catch(console.error);
