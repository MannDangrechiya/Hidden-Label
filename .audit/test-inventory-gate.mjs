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

async function testInventory() {
  const pg = new Client(PG);
  await pg.connect();

  const adminLogin = await req(`${BE}/auth/user/emailpass`, {
    method: "POST",
    body: { email: "admin@thehiddenlabel.com", password: "AdminPass123!" },
  });
  const adminHeaders = { authorization: `Bearer ${adminLogin.json.token}` };

  const invItem = await pg.query("SELECT id, sku FROM inventory_item LIMIT 1");
  const loc = await pg.query("SELECT id FROM stock_location LIMIT 1");
  const invLevelBefore = await pg.query(
    "SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1 AND location_id = $2",
    [invItem.rows[0].id, loc.rows[0].id]
  );

  console.log("Inventory Before:", invLevelBefore.rows[0]);

  const adjRes = await req(`${BE}/admin/inventory`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      inventory_item_id: invItem.rows[0].id,
      location_id: loc.rows[0].id,
      delta: 5,
      reason: "stock_count",
    },
  });

  const invLevelAfter = await pg.query(
    "SELECT stocked_quantity, reserved_quantity FROM inventory_level WHERE inventory_item_id = $1 AND location_id = $2",
    [invItem.rows[0].id, loc.rows[0].id]
  );

  console.log("Adjustment status:", adjRes.status, adjRes.json);
  console.log("Inventory After:", invLevelAfter.rows[0]);

  // Check audit event
  const auditRes = await pg.query(
    "SELECT action, entity, entity_id FROM audit_event WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1",
    [invItem.rows[0].id]
  );
  console.log("Audit event:", auditRes.rows[0]);

  await pg.end();
}

testInventory().catch(console.error);
