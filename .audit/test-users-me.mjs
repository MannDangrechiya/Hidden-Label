import fs from "node:fs";

const BE = "http://localhost:9000";

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
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

async function testAdminUsersMe() {
  console.log("=== TESTING /admin/users/me PRIVILEGE BYPASS & METHODS ===");

  // Login as readonly
  const roLogin = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    body: { email: "audit.readonly@thehiddenlabel.com", password: "AuditPass123!" },
  });
  const roToken = roLogin.json?.token;
  console.log("Readonly login status:", roLogin.status, "Token exists:", !!roToken);

  const headers = { authorization: `Bearer ${roToken}` };

  // 1. GET /admin/users/me
  const getMe = await req(`${BE}/admin/users/me`, { headers });
  console.log("GET /admin/users/me:", getMe.status, getMe.json?.user?.email, "Role:", getMe.json?.user?.metadata?.role);

  // 2. Can readonly send POST /admin/users/me to change role or escalate?
  const postMe = await req(`${BE}/admin/users/me`, {
    method: "POST",
    headers,
    body: {
      first_name: "Escalated",
      metadata: { role: "owner" },
    },
  });
  console.log("POST /admin/users/me:", postMe.status, postMe.json || postMe.text);

  // 3. Can readonly send PATCH or PUT to /admin/users/me?
  const patchMe = await req(`${BE}/admin/users/me`, {
    method: "PATCH",
    headers,
    body: {
      metadata: { role: "owner" },
    },
  });
  console.log("PATCH /admin/users/me:", patchMe.status);

  // 4. What about query string bypass on /admin/users/me?
  // E.g. /admin/users/me/../ or /admin/users/me/orders
  const bypass1 = await req(`${BE}/admin/users/me/../orders`, { headers });
  console.log("GET /admin/users/me/../orders:", bypass1.status);

  // 5. What about endsWith /users/me?
  // path.endsWith("/users/me") in middleware:
  // If an attacker calls /admin/orders/users/me or /admin/customers/users/me
  // Wait, does Medusa have a route for /admin/users/:id?
  const roId = getMe.json?.user?.id;
  const postUserId = await req(`${BE}/admin/users/${roId}`, {
    method: "POST",
    headers,
    body: { metadata: { role: "owner" } },
  });
  console.log("POST /admin/users/:id as self:", postUserId.status, postUserId.json?.message);

  // Check role after
  const getMeAfter = await req(`${BE}/admin/users/me`, { headers });
  console.log("GET /admin/users/me after test:", getMeAfter.status, "Role:", getMeAfter.json?.user?.metadata?.role);
}

testAdminUsersMe().catch(console.error);
