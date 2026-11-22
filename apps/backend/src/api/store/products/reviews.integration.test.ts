import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { GET as storeGet, POST as storePost } from "./[id]/reviews/route";
import { GET as adminGet } from "../../admin/reviews/route";
import { POST as adminAction } from "../../admin/reviews/[id]/action/route";

let iso: IsolatedDatabase;

interface CapturedResponse {
  statusCode: number;
  body: Record<string, unknown> | null;
}

function makeResponse(capture: CapturedResponse): MedusaResponse {
  const res = {
    status(code: number) {
      capture.statusCode = code;
      return res;
    },
    json(payload: Record<string, unknown>) {
      capture.body = payload;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return res as unknown as MedusaResponse;
}

function makeStoreRequest(
  productId: string,
  customerId: string | undefined,
  body?: Record<string, unknown>,
): MedusaRequest & { params: { id: string } } {
  return {
    params: { id: productId },
    body,
    auth_context: customerId ? { actor_id: customerId, actor_type: "customer" } : undefined,
    scope: {
      resolve: (key: unknown) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION || String(key).toLowerCase().includes("pg")) {
          return iso.db;
        }
        return iso.db;
      },
    },
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest & { params: { id: string } };
}

function makeAdminRequest(
  actorId: string | undefined,
  params?: { id: string },
  body?: Record<string, unknown>,
  query?: Record<string, string>,
): MedusaRequest & { params: { id: string }; query: Record<string, string> } {
  return {
    params: params ?? { id: "" },
    body,
    query: query ?? {},
    auth_context: actorId ? { actor_id: actorId, actor_type: "user" } : undefined,
    scope: {
      resolve: (key: unknown) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION || String(key).toLowerCase().includes("pg")) {
          return iso.db;
        }
        return iso.db;
      },
    },
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest & { params: { id: string }; query: Record<string, string> };
}

beforeAll(async () => {
  iso = await createIsolatedDatabase();

  await iso.db("user").insert([
    { id: "user_ops", email: "ops@thehiddenlabel.com", metadata: JSON.stringify({ role: "operations" }) },
    { id: "user_ro", email: "ro@thehiddenlabel.com", metadata: JSON.stringify({ role: "readonly" }) },
  ]);

  await iso.db("product").insert([
    { id: "prod_review_test", title: "Italian Silk Poplin Shirt", handle: "silk-shirt" },
  ]);

  // Order with customer_verified who purchased this product
  await iso.db("order").insert([
    { id: "order_rev_1", customer_id: "cust_buyer", total: 12000, status: "completed" },
  ]);
  await iso.db("order_item").insert([
    { id: "item_rev_1", order_id: "order_rev_1", item_id: "prod_review_test", quantity: 1, unit_price: 12000 },
  ]);
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Phase 5: Verified Product Reviews Engine", () => {
  it("denies unauthenticated review submissions with 401", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await storePost(makeStoreRequest("prod_review_test", undefined, { rating: 5, title: "Great", body: "Wonderful shirt" }), makeResponse(capture));
    expect(capture.statusCode).toBe(401);
  });

  it("rejects invalid rating numbers with 400", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await storePost(makeStoreRequest("prod_review_test", "cust_any", { rating: 6, title: "Great", body: "Wonderful shirt" }), makeResponse(capture));
    expect(capture.statusCode).toBe(400);
    expect(capture.body?.message).toContain("rating between 1 and 5");
  });

  it("submits a review with verified_purchase: false when customer has not bought the item", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await storePost(
      makeStoreRequest("prod_review_test", "cust_unverified", {
        rating: 4,
        title: "Lovely silhouette",
        body: "Fits nicely and drape is clean and structured.",
        author_name: "Aditya S.",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(201);
    const rev = capture.body?.review as Record<string, unknown>;
    expect(rev.verified_purchase).toBe(false);
    expect(rev.status).toBe("pending");
  });

  it("submits a review with verified_purchase: true when customer has an order for the product", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await storePost(
      makeStoreRequest("prod_review_test", "cust_buyer", {
        rating: 5,
        title: "Exceptional luxury cotton",
        body: "Superb drape and pristine craftsmanship on collar.",
        author_name: "Rajesh K.",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(201);
    const rev = capture.body?.review as Record<string, unknown>;
    expect(rev.verified_purchase).toBe(true);
    expect(rev.status).toBe("pending");
  });

  it("rejects duplicate reviews from the same customer for the same product with 409", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await storePost(
      makeStoreRequest("prod_review_test", "cust_buyer", {
        rating: 5,
        title: "Second attempt",
        body: "Trying to submit again to test duplicate guard.",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(409);
    expect(capture.body?.type).toBe("duplicate_review");
  });

  it("public GET returns only approved reviews and accurate aggregate stats", async () => {
    // Before approval: 0 approved reviews
    const initialCapture: CapturedResponse = { statusCode: 200, body: null };
    await storeGet(makeStoreRequest("prod_review_test", undefined), makeResponse(initialCapture));
    expect(initialCapture.statusCode).toBe(200);
    const stats0 = initialCapture.body?.stats as Record<string, unknown>;
    expect(stats0.count).toBe(0);
    expect(stats0.average_rating).toBe(0);

    // Admin approves the buyer review
    const pendingReviews = await iso.db("product_review").where({ product_id: "prod_review_test", status: "pending" });
    expect(pendingReviews.length).toBeGreaterThanOrEqual(2);

    // Admin lists reviews via admin API
    const adminListCapture: CapturedResponse = { statusCode: 200, body: null };
    await adminGet(makeAdminRequest("user_ops", {}, {}), makeResponse(adminListCapture));
    expect(adminListCapture.statusCode).toBe(200);

    const buyerReview = pendingReviews.find((r) => r.customer_id === "cust_buyer");
    expect(buyerReview).toBeDefined();
    if (!buyerReview) throw new Error("buyerReview not found");
    const actionCapture: CapturedResponse = { statusCode: 200, body: null };
    await adminAction(
      makeAdminRequest("user_ops", { id: buyerReview.id }, { action: "approve" }),
      makeResponse(actionCapture),
    );
    expect(actionCapture.statusCode).toBe(200);

    // Verify public GET now returns the approved review
    const approvedCapture: CapturedResponse = { statusCode: 200, body: null };
    await storeGet(makeStoreRequest("prod_review_test", undefined), makeResponse(approvedCapture));
    expect(approvedCapture.statusCode).toBe(200);

    const list = approvedCapture.body?.reviews as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(buyerReview.id);
    expect(list[0].verified_purchase).toBe(true);

    const stats1 = approvedCapture.body?.stats as Record<string, unknown>;
    expect(stats1.count).toBe(1);
    expect(stats1.average_rating).toBe(5);
  });
});
