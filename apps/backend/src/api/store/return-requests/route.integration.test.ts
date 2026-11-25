import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { GET } from "./route";
import { THL_MODULE } from "../../../modules/thl";

/**
 * Regression for the customer returns listing: each return response must carry the order's
 * friendly reference (order_display_id) so the storefront can render "THL-7" instead of the
 * raw order_01M89… id.
 */
describe("GET /store/return-requests — order reference (Integration)", () => {
  let iso: IsolatedDatabase;

  beforeEach(async () => {
    iso = await createIsolatedDatabase();

    await iso.db("order").insert({ id: "order_ref_01", customer_id: "cust_ref_01", display_id: 7 });
    await iso.db("order").insert({ id: "order_ref_02", customer_id: "cust_ref_01", display_id: 9 });

    await iso.db("return_request").insert([
      {
        id: "rma_ref_01",
        display_id: "1004",
        order_id: "order_ref_01",
        customer_id: "cust_ref_01",
        status: "requested",
        reason_code: "size_issue",
        refund_amount: "21999.00",
        requested_at: new Date(),
      },
      {
        id: "rma_ref_02",
        display_id: "1005",
        order_id: "order_ref_02",
        customer_id: "cust_ref_01",
        status: "approved",
        reason_code: "not_as_pictured",
        refund_amount: "4999.00",
        requested_at: new Date(),
      },
    ]);
  });

  afterEach(async () => {
    await iso.dispose();
  });

  function mockRequest(actorId: string | undefined) {
    return {
      auth_context: actorId ? { actor_id: actorId, actor_type: "customer" } : undefined,
      scope: {
        resolve: (key: unknown) => {
          const name = String(key);
          if (name.includes("pg") || name === "pgConnection") return iso.db;
          if (name.includes(THL_MODULE) || name.includes("thlModuleService")) {            return {
              listReturnRequests: async (
                filters: { customer_id?: string },
                config?: { order?: Record<string, string> },
              ) => {
                let q = iso.db("return_request");
                if (filters.customer_id) q = q.where({ customer_id: filters.customer_id });
                const order = config?.order ?? {};
                for (const [col, dir] of Object.entries(order)) q = q.orderBy(col, dir);
                return q;
              },
            };
          }
          return null;
        },
      },
    } as unknown as Parameters<typeof GET>[0];
  }

  function mockResponse() {
    let statusCode = 200;
    let jsonBody: unknown = null;
    const res = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      setHeader() {
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

  it("attaches the order display id to every return", async () => {
    const res = mockResponse();
    await GET(mockRequest("cust_ref_01"), res as unknown as Parameters<typeof GET>[1]);

    expect(res.getStatusCode()).toBe(200);
    const body = res.getBody() as {
      returns: { id: string; order_id: string; order_display_id: number | string | null }[];
    };
    expect(body.returns).toHaveLength(2);
    const byId = new Map(body.returns.map((r) => [r.id, r]));
    expect(byId.get("rma_ref_01")?.order_display_id).toBe(7);
    expect(byId.get("rma_ref_02")?.order_display_id).toBe(9);
  });

  it("still lists only the signed-in customer's returns, without the order reference leaking", async () => {
    await iso.db("return_request").insert({
      id: "rma_other",
      display_id: "1006",
      order_id: "order_ref_01",
      customer_id: "cust_other",
      status: "requested",
      reason_code: "size_issue",
      requested_at: new Date(),
    });

    const res = mockResponse();
    await GET(mockRequest("cust_ref_01"), res as unknown as Parameters<typeof GET>[1]);

    const body = res.getBody() as { returns: { id: string }[] };
    expect(body.returns.map((r) => r.id).sort()).toEqual(["rma_ref_01", "rma_ref_02"]);
  });

  it("401s without a signed-in customer", async () => {
    const res = mockResponse();
    await GET(mockRequest(undefined), res as unknown as Parameters<typeof GET>[1]);
    expect(res.getStatusCode()).toBe(401);
  });
});
