import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { refundOperationKey } from "../../../lib/refund-operations";
import { POST } from "./[id]/actions/route";

vi.mock("@medusajs/medusa/core-flows", () => ({
  refundPaymentWorkflow: vi.fn(() => ({
    run: vi.fn(async () => ({ result: [{ id: "ref_flow_mock_999" }] })),
  })),
  capturePaymentWorkflow: vi.fn(() => ({
    run: vi.fn(async () => ({})),
  })),
  cancelOrderWorkflow: vi.fn(() => ({
    run: vi.fn(async () => ({})),
  })),
  createOrderFulfillmentWorkflow: vi.fn(() => ({
    run: vi.fn(async () => ({})),
  })),
}));

let iso: IsolatedDatabase;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

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

function makeRequest(
  orderId: string,
  actorId: string | undefined,
  body: Record<string, unknown>,
): MedusaRequest {
  const scope = {
    resolve(key: unknown) {
      if (key === ContainerRegistrationKeys.LOGGER) {
        return mockLogger;
      }
      return iso.db;
    },
  };
  return {
    params: { id: orderId },
    body,
    auth_context: actorId ? { actor_id: actorId, actor_type: "user" } : undefined,
    scope,
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest;
}

async function callRoute(
  orderId: string,
  actorId: string | undefined,
  body: Record<string, unknown>,
): Promise<CapturedResponse> {
  const capture: CapturedResponse = { statusCode: 200, body: null };
  await POST(
    makeRequest(orderId, actorId, body) as unknown as MedusaRequest & { params: { id: string } },
    makeResponse(capture),
  );
  return capture;
}

beforeAll(async () => {
  iso = await createIsolatedDatabase();

  await iso.db("user").insert([
    { id: "user_ops", email: "ops@thehiddenlabel.com", metadata: JSON.stringify({ role: "operations" }) },
    { id: "user_readonly", email: "ro@thehiddenlabel.com", metadata: JSON.stringify({ role: "readonly" }) },
    { id: "user_norole", email: "norole@thehiddenlabel.com", metadata: JSON.stringify({}) },
  ]);

  await iso.db("order").insert([
    { id: "order_captured_1", display_id: 101, status: "pending", total: 25000 },
    { id: "order_uncaptured_2", display_id: 102, status: "pending", total: 15000 },
  ]);

  await iso.db("order_payment_collection").insert([
    { order_id: "order_captured_1", payment_collection_id: "pay_col_1" },
    { order_id: "order_uncaptured_2", payment_collection_id: "pay_col_2" },
  ]);

  await iso.db("payment").insert([
    {
      id: "pay_captured_1",
      payment_collection_id: "pay_col_1",
      amount: 25000,
      captured_at: new Date(),
    },
    {
      id: "pay_uncaptured_2",
      payment_collection_id: "pay_col_2",
      amount: 15000,
      captured_at: null,
    },
  ]);
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("POST /admin/orders/:id/actions (refund route R-01)", () => {
  it("denies unauthenticated requests with 401", async () => {
    const result = await callRoute("order_captured_1", undefined, { action: "refund", reason: "test" });
    expect(result.statusCode).toBe(401);
  });

  it("denies readonly staff with 403", async () => {
    const result = await callRoute("order_captured_1", "user_readonly", { action: "refund", reason: "test" });
    expect(result.statusCode).toBe(403);
  });

  it("denies staff without role with 403", async () => {
    const result = await callRoute("order_captured_1", "user_norole", { action: "refund", reason: "test" });
    expect(result.statusCode).toBe(403);
  });

  it("rejects an invalid action with 400", async () => {
    const result = await callRoute("order_captured_1", "user_ops", { action: "destroy" });
    expect(result.statusCode).toBe(400);
    expect(result.body?.type).toBe("invalid_data");
  });

  it("returns 404 when order does not exist", async () => {
    const result = await callRoute("order_missing_999", "user_ops", { action: "refund", reason: "Damaged" });
    expect(result.statusCode).toBe(404);
  });

  it("rejects a refund without a reason with 400", async () => {
    const result = await callRoute("order_captured_1", "user_ops", { action: "refund" });
    expect(result.statusCode).toBe(400);
    expect(result.body?.message).toContain("refund reason is required");
  });

  it("rejects refund when no captured payment exists with 422", async () => {
    const result = await callRoute("order_uncaptured_2", "user_ops", {
      action: "refund",
      reason: "Customer changed mind",
    });
    expect(result.statusCode).toBe(422);
    expect(result.body?.message).toContain("No captured payment exists");
  });

  it("rejects invalid or negative refund amounts with 400", async () => {
    const zeroRes = await callRoute("order_captured_1", "user_ops", {
      action: "refund",
      reason: "Defective item",
      amount: 0,
    });
    expect(zeroRes.statusCode).toBe(400);

    const negativeRes = await callRoute("order_captured_1", "user_ops", {
      action: "refund",
      reason: "Defective item",
      amount: -500,
    });
    expect(negativeRes.statusCode).toBe(400);
  });

  it("successfully processes a refund, claims mutex, and writes audit event", async () => {
    const result = await callRoute("order_captured_1", "user_ops", {
      action: "refund",
      reason: "Fabric defect on lapel",
      amount: 25000,
    });

    expect(result.statusCode).toBe(200);
    expect(result.body?.action).toBe("refund");
    expect((result.body?.order as Record<string, unknown>)?.id).toBe("order_captured_1");

    // Verify refund_operation entry in PostgreSQL
    const operations = await iso.db("refund_operation").where({ order_id: "order_captured_1" });
    expect(operations).toHaveLength(1);
    expect(operations[0].status).toBe("completed");
    expect(operations[0].refund_id).toBe("ref_flow_mock_999");
    expect(operations[0].actor_id).toBe("user_ops");

    // Verify audit_event entry in PostgreSQL
    const audits = await iso.db("audit_event").where({ entity_id: "order_captured_1" });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0].action).toBe("order.refund");
    expect(audits[0].actor_id).toBe("user_ops");
  });

  it("returns idempotent duplicate response for identical refund request", async () => {
    const result = await callRoute("order_captured_1", "user_ops", {
      action: "refund",
      reason: "Fabric defect on lapel",
      amount: 25000,
    });

    expect(result.statusCode).toBe(200);
    expect(result.body?.duplicate).toBe(true);
    expect(result.body?.refund_id).toBe("ref_flow_mock_999");
    expect(result.body?.idempotency_key).toBeDefined();

    // Ensure no second operation was created
    const operations = await iso.db("refund_operation").where({ order_id: "order_captured_1" });
    expect(operations).toHaveLength(1);
  });

  it("enforces explicit retry: true when a previous refund attempt failed", async () => {
    // Insert a failed refund operation manually
    const failedOrder = { id: "order_failed_test", display_id: 103, status: "pending", total: 10000 };
    await iso.db("order").insert(failedOrder);
    await iso.db("order_payment_collection").insert({ order_id: failedOrder.id, payment_collection_id: "col_fail" });
    await iso.db("payment").insert({
      id: "pay_fail",
      payment_collection_id: "col_fail",
      amount: 10000,
      captured_at: new Date(),
    });

    // Derive the exact idempotency key matching the intent
    const key = refundOperationKey({
      orderId: failedOrder.id,
      paymentId: "pay_fail",
      amount: 10000,
      reason: "Gateway timeout simulation",
    });

    // Insert a failed refund operation manually
    await iso.db("refund_operation").insert({
      id: "rf_fail_1",
      idempotency_key: key,
      order_id: failedOrder.id,
      payment_id: "pay_fail",
      amount: 10000,
      reason: "Gateway timeout simulation",
      status: "failed",
      error: "Gateway timeout",
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Calling again without retry: true should return 409 refund_failed
    const retryAttemptWithoutFlag = await callRoute(failedOrder.id, "user_ops", {
      action: "refund",
      reason: "Gateway timeout simulation",
      amount: 10000,
    });
    expect(retryAttemptWithoutFlag.statusCode).toBe(409);
    expect(retryAttemptWithoutFlag.body?.type).toBe("refund_failed");

    // Calling with retry: true should succeed
    const retrySuccess = await callRoute(failedOrder.id, "user_ops", {
      action: "refund",
      reason: "Gateway timeout simulation",
      amount: 10000,
      retry: true,
    });
    expect(retrySuccess.statusCode).toBe(200);
  });
});
