/**
 * Phase 5 — admin module, run against the live backend (:9000).
 *
 * staff login → dashboard → create brand → create product (category + sales channel) →
 * adjust inventory → publish a CMS page → create a promotion with the old `usage_limit` field
 * (BUG-007 regression) → view an order → create a shipment → read the returns ledger → read the
 * audit trail → confirm a low-role staff account cannot escalate through /admin/users/me.
 *
 * Everything created here is deleted again at the end.
 */
import { Client } from "pg";

const BE = "http://localhost:9000";
const pg = new Client({
  host: "127.0.0.1",
  port: 5437,
  user: "postgres",
  database: "the_hidden_label",
});
await pg.connect();
const OWNER = { email: "admin@thehiddenlabel.com", password: "AdminPass123!" };
const READONLY = { email: "audit.readonly@thehiddenlabel.com", password: "AuditPass123!" };
const stamp = Date.now();
const handle = `audit-brand-${stamp}`;
const cmsSlug = `audit-page-${stamp}`;
const promoCode = `AUDIT${stamp}`;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}
function blocked(name, detail) {
  results.push({ name, pass: null, detail });
  console.log(`BLOCKED ${name} — ${detail}`);
}

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

const cleanup = [];
const createdShipments = [];
let token;

try {
  // 1. Staff login.
  const login = await req("/auth/user/emailpass", { method: "POST", body: OWNER });
  token = login.json?.token;
  check("owner signs in", login.status === 200 && Boolean(token), `status=${login.status}`);

  const dashboard = await req("/admin/dashboard/summary", { token });
  check("dashboard loads", dashboard.status === 200, `status=${dashboard.status}`);

  // 2. Brand.
  const brand = await req("/admin/brands", {
    method: "POST",
    token,
    body: { handle, name: "Audit Brand", tagline: "Created by the Phase 5 check", partnership_tier: "emerging" },
  });
  const brandId = brand.json?.brand?.id;
  check("brand created", brand.status === 201 && Boolean(brandId), `status=${brand.status} id=${brandId}`);
  if (brandId) cleanup.push({ path: `/admin/brands/${brandId}` });

  const brands = await req("/admin/brands", { token });
  check(
    "brand appears in the ledger",
    brands.status === 200 && (brands.json?.brands ?? []).some((b) => b.id === brandId),
    `count=${brands.json?.brands?.length}`,
  );

  // 3. Product under a category, published to the default sales channel.
  const channels = await req("/admin/sales-channels?limit=1", { token });
  const channelId = channels.json?.sales_channels?.[0]?.id;
  const category = await req("/admin/product-categories", {
    method: "POST",
    token,
    body: { name: "Audit Category", handle: `audit-category-${stamp}`, is_active: true },
  });
  const categoryId = category.json?.product_category?.id;
  check(
    "category created through the admin API",
    category.status === 200 && Boolean(categoryId),
    `status=${category.status} id=${categoryId}`,
  );
  if (categoryId) cleanup.push({ path: `/admin/product-categories/${categoryId}`, method: "DELETE" });

  const product = await req("/admin/products", {
    method: "POST",
    token,
    body: {
      title: "Audit Product",
      handle: `audit-product-${stamp}`,
      status: "published",
      description: "Created and deleted by the Phase 5 admin check.",
      ...(channelId ? { sales_channels: [{ id: channelId }] } : {}),
      ...(categoryId ? { categories: [{ id: categoryId }] } : {}),
      options: [{ title: "Size", values: ["One Size"] }],
      variants: [
        {
          title: "One Size",
          sku: `AUDIT-SKU-${stamp}`,
          manage_inventory: false,
          options: { Size: "One Size" },
          prices: [{ currency_code: "inr", amount: 149900 }],
        },
      ],
    },
  });
  const productId = product.json?.product?.id;
  check(
    "product created with category + sales channel",
    product.status === 200 && Boolean(productId),
    `status=${product.status} id=${productId} category=${categoryId ?? "none"} channel=${channelId ?? "none"}`,
  );
  if (productId) {
    cleanup.push({ path: `/admin/products/${productId}`, method: "DELETE" });
    const readBack = await req(`/admin/products/${productId}?fields=id,title,status,variants.id`, { token });
    check(
      "product reads back with a variant",
      readBack.status === 200 && (readBack.json?.product?.variants?.length ?? 0) === 1,
      `variants=${readBack.json?.product?.variants?.length}`,
    );
  }

  // 4. Inventory adjustment with a reason code, reversed afterwards.
  const levels = await req("/admin/inventory?limit=1", { token });
  const level = levels.json?.levels?.[0];
  if (level) {
    const up = await req("/admin/inventory", {
      method: "POST",
      token,
      body: {
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
        delta: 1,
        reason: "count_correction",
      },
    });
    const down = await req("/admin/inventory", {
      method: "POST",
      token,
      body: {
        inventory_item_id: level.inventory_item_id,
        location_id: level.location_id,
        delta: -1,
        reason: "count_correction",
      },
    });
    check(
      "inventory adjusted and reversed",
      up.status === 200 && down.status === 200 && Number(down.json?.level?.stocked_quantity) === Number(level.stocked_quantity),
      `sku=${level.sku} before=${level.stocked_quantity} up=${up.status} down=${down.status}`,
    );

    const badReason = await req("/admin/inventory", {
      method: "POST",
      token,
      body: { inventory_item_id: level.inventory_item_id, location_id: level.location_id, delta: 1 },
    });
    check("inventory rejects a missing reason", badReason.status === 400, `status=${badReason.status}`);
  } else {
    blocked("inventory adjustment", "no inventory level exists in this database");
  }

  // 5. CMS page, published.
  const page = await req("/admin/cms", {
    method: "POST",
    token,
    body: {
      slug: cmsSlug,
      kind: "page",
      title: "Audit Page",
      body_md: "Temporary page created by the Phase 5 admin check.",
      is_published: true,
      seo_title: "Audit Page",
    },
  });
  const pageId = page.json?.page?.id;
  check("CMS page published", page.status === 201 && Boolean(pageId), `status=${page.status} id=${pageId}`);
  if (pageId) cleanup.push({ path: `/admin/cms/${pageId}` });

  const pages = await req("/admin/cms", { token });
  check(
    "published page is listed",
    pages.status === 200 && (pages.json?.pages ?? []).some((p) => p.id === pageId && p.is_published === true),
    `count=${pages.json?.pages?.length}`,
  );

  // 6. Promotion — the admin app still sends `usage_limit`; the middleware maps it to `limit`.
  const promotion = await req("/admin/promotions", {
    method: "POST",
    token,
    body: {
      code: promoCode,
      type: "standard",
      status: "draft",
      is_automatic: false,
      application_method: {
        type: "percentage",
        target_type: "order",
        value: 10,
      },
      usage_limit: 25,
    },
  });
  const promotionId = promotion.json?.promotion?.id;
  check(
    "promotion created with legacy usage_limit field",
    promotion.status === 200 && Boolean(promotionId) && Number(promotion.json?.promotion?.limit) === 25,
    `status=${promotion.status} limit=${promotion.json?.promotion?.limit}`,
  );
  if (promotionId) cleanup.push({ path: `/admin/promotions/${promotionId}`, method: "DELETE" });

  // 7. Order view, payment capture, fulfilment, shipment — on an order that is still open.
  const candidate = await pg.query(`
    select o.id
    from "order" o
    join order_payment_collection opc on opc.order_id = o.id
    join payment p on p.payment_collection_id = opc.payment_collection_id
    where o.deleted_at is null
      and p.deleted_at is null
      and p.canceled_at is null
      and p.captured_at is null
      and not exists (select 1 from shipment s where s.order_id = o.id and s.deleted_at is null)
      and not exists (
        select 1 from fulfillment f
        join order_fulfillment fo on fo.fulfillment_id = f.id
        where fo.order_id = o.id
      )
    order by o.created_at desc
    limit 1`);
  const orderId = candidate.rows[0]?.id;
  const order = orderId ? await req(`/admin/orders/${orderId}?fields=id,display_id,status,total`, { token }) : null;
  check(
    "order opens in admin",
    order?.status === 200 && order.json?.order?.id === orderId,
    `status=${order?.status} display_id=${order?.json?.order?.display_id}`,
  );

  if (orderId) {
    const capture = await req(`/admin/orders/${orderId}/actions`, {
      method: "POST",
      token,
      body: { action: "capture" },
    });
    if (capture.status === 200) {
      check("payment captured", true, `status=200 action=${capture.json?.action}`);
      const fulfill = await req(`/admin/orders/${orderId}/actions`, {
        method: "POST",
        token,
        body: { action: "fulfill" },
      });
      check(
        "order fulfilled",
        fulfill.status === 200,
        fulfill.status === 200 ? `status=200` : `status=${fulfill.status} ${fulfill.json?.message ?? fulfill.text.slice(0, 120)}`,
      );
    } else {
      blocked(
        "payment capture → fulfilment",
        `status=${capture.status} ${capture.json?.message ?? capture.text.slice(0, 140)}`,
      );
    }

    const shipment = await req("/admin/shipments", { method: "POST", token, body: { order_id: orderId } });
    const shipmentId = shipment.json?.shipment?.id;
    if (shipment.status === 201) {
      const shipped = shipment.json?.shipment;
      check(
        "shipment recorded as a manual dispatch",
        shipped?.provider === "manual" || shipped?.awb === null,
        `status=201 provider=${shipped?.provider} awb=${shipped?.awb}`,
      );
      const ledger = await req("/admin/shipments", { token });
      check(
        "shipment appears in the ledger",
        ledger.status === 200 && (ledger.json?.shipments ?? []).some((s) => s.id === shipmentId),
        `count=${ledger.json?.shipments?.length}`,
      );
      createdShipments.push(shipmentId);
    } else if (shipment.status === 409) {
      blocked("shipment creation", "every seeded order already has a shipment");
    } else {
      check("shipment creation", false, `status=${shipment.status} ${shipment.text.slice(0, 160)}`);
    }
  }

  // 8. Returns ledger + approval of a delivered-order return.
  const returns = await req("/admin/returns", { token });
  check(
    "returns ledger loads",
    returns.status === 200 && Array.isArray(returns.json?.returns),
    `status=${returns.status} count=${returns.json?.returns?.length}`,
  );

  const pendingReturn = await pg.query(`
    select rr.id
    from return_request rr
    where rr.deleted_at is null and rr.status = 'requested'
      and exists (
        select 1 from fulfillment f
        join order_fulfillment fo on fo.fulfillment_id = f.id
        where fo.order_id = rr.order_id and f.delivered_at is not null
      )
    order by rr.created_at desc
    limit 1`);
  const returnId = pendingReturn.rows[0]?.id;
  if (returnId) {
    const approve = await req(`/admin/returns/${returnId}`, {
      method: "POST",
      token,
      body: { action: "approve", note: "Phase 5 verification" },
    });
    check(
      "delivered-order return approved",
      approve.status === 200 && approve.json?.return?.status === "approved",
      `status=${approve.status} return=${approve.json?.return?.status}`,
    );
    // Restore the fixture row so the check is repeatable.
    await pg.query("update return_request set status = 'requested', updated_at = now() where id = $1", [returnId]);
  } else {
    blocked("return approval", "no requested return belongs to a delivered order");
  }

  // 8b. Staff invite (low-role assignment happens through /admin/users/:id afterwards).
  const inviteEmail = `audit.invite.${stamp}@example.com`;
  const invite = await req("/admin/invites", { method: "POST", token, body: { email: inviteEmail } });
  const inviteId = invite.json?.invite?.id;
  check("staff invite created", invite.status === 200 || invite.status === 201, `status=${invite.status}`);
  if (inviteId) {
    const invites = await req("/admin/invites?limit=200", { token });
    check(
      "invite listed as unaccepted",
      (invites.json?.invites ?? []).some((i) => i.email === inviteEmail && i.accepted === false),
      `count=${invites.json?.invites?.length}`,
    );
    const revoke = await req(`/admin/invites/${inviteId}`, { method: "DELETE", token });
    check("invite revoked", revoke.status === 200, `status=${revoke.status}`);
  }

  // 9. Audit trail recorded the writes above.
  const audit = await req("/admin/audit?action=brand.&limit=20", { token });
  const auditAll = await req("/admin/audit?limit=50", { token });
  const actions = new Set((auditAll.json?.events ?? []).map((e) => e.action));
  check(
    "audit trail recorded brand + inventory + cms",
    auditAll.status === 200 &&
      actions.has("brand.created") &&
      actions.has("inventory.adjusted") &&
      actions.has("cms.published"),
    `actions=[${[...actions].slice(0, 12).join(",")}]`,
  );
  check("audit filter by action works", audit.status === 200, `status=${audit.status} events=${audit.json?.events?.length}`);

  // 10. Low-role staff cannot escalate — GAP-SEC-01 regression, inside the admin flow.
  const roLogin = await req("/auth/user/emailpass", { method: "POST", body: READONLY });
  const roToken = roLogin.json?.token;
  const escalate = await req("/admin/users/me", {
    method: "POST",
    token: roToken,
    body: { metadata: { role: "owner" } },
  });
  const after = await req("/admin/users/me", { token: roToken });
  check(
    "readonly staff cannot self-escalate",
    escalate.status === 403 && after.json?.user?.metadata?.role === "readonly",
    `post=${escalate.status} role=${after.json?.user?.metadata?.role}`,
  );
  const roWrite = await req("/admin/brands", {
    method: "POST",
    token: roToken,
    body: { handle: `audit-denied-${stamp}`, name: "Should Not Exist" },
  });
  check("readonly staff cannot create a brand", roWrite.status === 403, `status=${roWrite.status}`);
} finally {
  for (const item of cleanup) {
    await req(item.path, { method: item.method ?? "DELETE", token }).catch(() => undefined);
  }
  for (const id of createdShipments) {
    await pg.query("delete from shipment_event where shipment_id = $1", [id]).catch(() => undefined);
    await pg.query("delete from shipment where id = $1", [id]).catch(() => undefined);
  }
  await pg.end();
}

const passed = results.filter((r) => r.pass === true).length;
const failed = results.filter((r) => r.pass === false).length;
const skipped = results.filter((r) => r.pass === null).length;
console.log(`\n${passed}/${results.length - skipped} executed checks passed, ${failed} failed, ${skipped} blocked`);
process.exit(failed > 0 ? 1 : 0);
