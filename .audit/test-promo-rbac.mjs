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
  try { json = JSON.parse(text); } catch { /* response was not JSON */ }
  return { status: res.status, text, json };
}

async function testPostPromotionsAsReadonly() {
  const roLogin = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    body: { email: "audit.readonly@thehiddenlabel.com", password: "AuditPass123!" },
  });
  const token = roLogin.json?.token;
  const headers = { authorization: `Bearer ${token}` };

  const postPromo = await req(`${BE}/admin/promotions`, {
    method: "POST",
    headers,
    body: {
      code: "HACKED100",
      type: "standard",
      application_method: {
        type: "percentage",
        value: 100,
        currency_code: "inr",
        target_type: "order",
      },
    },
  });
  console.log("POST /admin/promotions as readonly status:", postPromo.status, postPromo.json);
}

testPostPromotionsAsReadonly().catch(console.error);
