import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { POST } from "./route";
import { sendOrderDeliveredEmail } from "../../../../lib/order-email";

// Mocked so a delivered scan can exercise both an email failure and success without a mail
// provider. Regression: a delivered webhook used to answer 500 after saving the scan when the
// delivery email threw (Defect 2) — it must degrade to a logged skip and still return 200.
vi.mock("../../../../lib/order-email", () => ({ sendOrderDeliveredEmail: vi.fn() }));

describe("Shiprocket Webhook Route (Integration)", () => {
  let iso: IsolatedDatabase;
  const originalToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
  const TEST_TOKEN = "secret_shiprocket_webhook_token_test_123";

  beforeEach(async () => {
    process.env.SHIPROCKET_WEBHOOK_TOKEN = TEST_TOKEN;
    vi.mocked(sendOrderDeliveredEmail).mockReset();
    vi.mocked(sendOrderDeliveredEmail).mockResolvedValue({
      sent: false,
      status: "skipped_unconfigured",
      reason: "RESEND_API_KEY is not configured.",
    });
    iso = await createIsolatedDatabase();

    // Seed order + fulfillment so the delivered handshake can be verified end to end
    await iso.db("order").insert({ id: "order_wh_test_01", display_id: 11 });
    await iso.db("fulfillment").insert({ id: "ful_wh_test_01" });
    await iso.db("order_fulfillment").insert({
      order_id: "order_wh_test_01",
      fulfillment_id: "ful_wh_test_01",
    });

    // Seed test shipment
    await iso.db("shipment").insert({
      id: "shp_wh_test_01",
      order_id: "order_wh_test_01",
      provider: "shiprocket",
      awb: "SRMOCK-TEST-WH-01",
      courier: "Delhivery Surface",
      status: "pickup_scheduled",
    });
  });

  afterEach(async () => {
    process.env.SHIPROCKET_WEBHOOK_TOKEN = originalToken;
    await iso.dispose();
  });

  function mockRequest(options: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  }) {
    return {
      headers: options.headers ?? {},
      query: options.query ?? {},
      body: options.body,
      scope: {
        resolve: (key: unknown) => {
          if (String(key).includes("pg") || key === "pgConnection") return iso.db;
          if (String(key).includes("thl") || key === "thlModuleService") {
            return {
              listShipments: async (filters: { awb?: string }) => {
                if (filters.awb) {
                  return iso.db("shipment").where({ awb: filters.awb });
                }
                return iso.db("shipment");
              },
            };
          }
          if (String(key).includes("logger")) {
            return {
              info: () => {},
              warn: () => {},
              error: () => {},
            };
          }
          return null;
        },
      },
    } as unknown as Parameters<typeof POST>[0];
  }

  function mockResponse() {
    let statusCode = 200;
    let jsonBody: unknown = null;
    const res = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(body: unknown) {
        jsonBody = body;
        return res;
      },
      getStatusCode() {
        return statusCode;
      },
      getBody() {
        return jsonBody;
      },
    };
    return res;
  }

  it("rejects unauthenticated requests without valid token", async () => {
    const req = mockRequest({
      headers: { "x-webhook-token": "wrong_token" },
      body: { awb: "SRMOCK-TEST-WH-01", current_status: "IN TRANSIT" },
    });
    const res = mockResponse();

    await POST(req, res as unknown as Parameters<typeof POST>[1]);

    expect(res.getStatusCode()).toBe(401);
    expect((res.getBody() as { type: string }).type).toBe("unauthorized");
  });

  it("authenticates via header x-webhook-token and processes tracking update", async () => {
    const req = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: {
        awb: "SRMOCK-TEST-WH-01",
        current_status: "IN TRANSIT",
        scan_date: "2026-11-21 15:00:00",
      },
    });
    const res = mockResponse();

    await POST(req, res as unknown as Parameters<typeof POST>[1]);

    expect(res.getStatusCode()).toBe(200);
    const body = res.getBody() as { received: boolean; status: string; matched: boolean };
    expect(body.received).toBe(true);
    expect(body.matched).toBe(true);
    expect(body.status).toBe("in_transit");

    // Check DB state
    const updated = await iso.db("shipment").where({ id: "shp_wh_test_01" }).first();
    expect(updated.status).toBe("in_transit");
  });

  it("authenticates via query parameter token fallback", async () => {
    const req = mockRequest({
      query: { token: TEST_TOKEN },
      body: {
        awb: "SRMOCK-TEST-WH-01",
        current_status: "OUT FOR DELIVERY",
        scan_date: "2026-11-21 16:00:00",
      },
    });
    const res = mockResponse();

    await POST(req, res as unknown as Parameters<typeof POST>[1]);

    expect(res.getStatusCode()).toBe(200);
    const body = res.getBody() as { received: boolean; status: string };
    expect(body.received).toBe(true);
    expect(body.status).toBe("out_for_delivery");
  });

  it("deduplicates replayed webhook deliveries", async () => {
    const payload = {
      event_id: "sr_webhook_evt_unique_123",
      awb: "SRMOCK-TEST-WH-01",
      current_status: "OUT FOR DELIVERY",
      scan_date: "2026-11-21 16:00:00",
    };

    const req1 = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: payload,
    });
    const res1 = mockResponse();
    await POST(req1, res1 as unknown as Parameters<typeof POST>[1]);
    expect((res1.getBody() as { received: boolean; duplicate?: boolean }).duplicate).toBeFalsy();

    // Replay exact same webhook event
    const req2 = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: payload,
    });
    const res2 = mockResponse();
    await POST(req2, res2 as unknown as Parameters<typeof POST>[1]);

    expect(res2.getStatusCode()).toBe(200);
    expect((res2.getBody() as { received: boolean; duplicate: boolean }).duplicate).toBe(true);
  });

  it("enforces anti-regression: out-of-order scans cannot revert delivered status back to in_transit", async () => {
    // 1. Advance to delivered
    const reqDelivered = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: {
        event_id: "sr_evt_delivered_01",
        awb: "SRMOCK-TEST-WH-01",
        current_status: "DELIVERED",
        scan_date: "2026-11-21 17:00:00",
      },
    });
    const resDelivered = mockResponse();
    await POST(reqDelivered, resDelivered as unknown as Parameters<typeof POST>[1]);

    let shipment = await iso.db("shipment").where({ id: "shp_wh_test_01" }).first();
    expect(shipment.status).toBe("delivered");

    // 2. Out-of-order delayed scan arriving later says "IN TRANSIT"
    const reqLateScan = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: {
        event_id: "sr_evt_late_scan_01",
        awb: "SRMOCK-TEST-WH-01",
        current_status: "IN TRANSIT",
        scan_date: "2026-11-21 15:30:00",
      },
    });
    const resLateScan = mockResponse();
    await POST(reqLateScan, resLateScan as unknown as Parameters<typeof POST>[1]);

    expect(resLateScan.getStatusCode()).toBe(200);
    const body = resLateScan.getBody() as { regressed: boolean; status: string };
    expect(body.regressed).toBe(true);
    expect(body.status).toBe("delivered");

    // Shipment remains delivered
    shipment = await iso.db("shipment").where({ id: "shp_wh_test_01" }).first();
    expect(shipment.status).toBe("delivered");
  });

  it("marks the Medusa fulfillment delivered on a delivered scan", async () => {
    const req = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: {
        event_id: "sr_evt_fulfillment_01",
        awb: "SRMOCK-TEST-WH-01",
        current_status: "DELIVERED",
        scan_date: "2026-11-21 18:00:00",
      },
    });
    const res = mockResponse();
    await POST(req, res as unknown as Parameters<typeof POST>[1]);

    expect(res.getStatusCode()).toBe(200);
    const fulfillment = await iso.db("fulfillment").where({ id: "ful_wh_test_01" }).first();
    expect(fulfillment.delivered_at).not.toBeNull();
  });

  it("returns 200 and keeps the delivery state even when the delivery email throws", async () => {
    vi.mocked(sendOrderDeliveredEmail).mockRejectedValue(
      new Error("column order.total does not exist"),
    );

    const req = mockRequest({
      headers: { "x-webhook-token": TEST_TOKEN },
      body: {
        event_id: "sr_evt_email_fail_01",
        awb: "SRMOCK-TEST-WH-01",
        current_status: "DELIVERED",
        scan_date: "2026-11-21 19:00:00",
      },
    });
    const res = mockResponse();
    await POST(req, res as unknown as Parameters<typeof POST>[1]);

    expect(res.getStatusCode()).toBe(200);
    const body = res.getBody() as { received: boolean; matched: boolean; status: string };
    expect(body.received).toBe(true);
    expect(body.matched).toBe(true);
    expect(body.status).toBe("delivered");

    // Delivery state saved despite the email failure
    const shipment = await iso.db("shipment").where({ id: "shp_wh_test_01" }).first();
    expect(shipment.status).toBe("delivered");
    expect(shipment.delivered_at).not.toBeNull();
    const fulfillment = await iso.db("fulfillment").where({ id: "ful_wh_test_01" }).first();
    expect(fulfillment.delivered_at).not.toBeNull();
  });
});
