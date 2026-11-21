import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createIsolatedDatabase } from "../../../../test/integration-db";
import { POST } from "./route";

describe("POST /webhooks/razorpay (integration)", () => {
  const webhookSecret = "test_webhook_secret_razorpay_999";

  function createMockReqRes(options: {
    secret?: string;
    signature?: string;
    rawBody?: Buffer;
    body?: unknown;
    headers?: Record<string, string>;
    db: unknown;
  }) {
    if (options.secret !== undefined) {
      process.env.RAZORPAY_WEBHOOK_SECRET = options.secret;
    } else {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    }

    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    const req = {
      headers: {
        ...(options.signature ? { "x-razorpay-signature": options.signature } : {}),
        ...(options.headers ?? {}),
      },
      rawBody: options.rawBody,
      body: options.body,
      scope: {
        resolve: (key: unknown) => {
          if (key === ContainerRegistrationKeys.LOGGER) return mockLogger;
          if (key === ContainerRegistrationKeys.PG_CONNECTION) return options.db;
          throw new Error(`Unknown registration key ${String(key)}`);
        },
      },
    } as unknown as MedusaRequest;

    let statusCode = 200;
    let jsonBody: unknown = null;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: unknown) => {
        jsonBody = data;
        return res;
      },
    } as unknown as MedusaResponse;

    return {
      req,
      res,
      getStatus: () => statusCode,
      getBody: () => jsonBody as Record<string, unknown>,
    };
  }

  it("returns 503 when RAZORPAY_WEBHOOK_SECRET is not configured", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const { req, res, getStatus, getBody } = createMockReqRes({
        secret: "",
        db,
      });

      await POST(req, res);
      expect(getStatus()).toBe(503);
      expect(getBody().type).toBe("not_configured");
    } finally {
      await dispose();
    }
  });

  it("returns 400 when signature or body is missing", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const { req, res, getStatus } = createMockReqRes({
        secret: webhookSecret,
        signature: "",
        rawBody: undefined,
        db,
      });

      await POST(req, res);
      expect(getStatus()).toBe(400);
    } finally {
      await dispose();
    }
  });

  it("returns 401 when signature is invalid or forged", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      const { req, res, getStatus } = createMockReqRes({
        secret: webhookSecret,
        signature: "forged_signature_0000000000000000000000000000000000000000000000000000000000000000",
        rawBody,
        body: JSON.parse(rawBody.toString()),
        db,
      });

      await POST(req, res);
      expect(getStatus()).toBe(401);
    } finally {
      await dispose();
    }
  });

  it("verifies signature, processes webhook, writes audit and handles replay as duplicate", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const eventPayload = {
        id: "evt_test_captured_01",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_captured_01",
              order_id: "order_rzp_01",
              amount: 899900,
              status: "captured",
            },
          },
        },
      };

      const rawBody = Buffer.from(JSON.stringify(eventPayload));
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      // First delivery: should be accepted and processed
      const call1 = createMockReqRes({
        secret: webhookSecret,
        signature: validSignature,
        rawBody,
        body: eventPayload,
        headers: { "x-razorpay-event-id": "evt_test_captured_01" },
        db,
      });

      await POST(call1.req, call1.res);
      expect(call1.getStatus()).toBe(200);
      expect(call1.getBody().received).toBe(true);
      expect(call1.getBody().duplicate).toBe(false);

      // Verify audit_event and webhook_event created
      const webhookRows = await db("webhook_event").where({ event_id: "evt_test_captured_01" });
      expect(webhookRows.length).toBe(1);
      expect(webhookRows[0].entity_id).toBe("pay_captured_01");

      const auditRows = await db("audit_event").where({ entity_id: "pay_captured_01" });
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].action).toBe("payment.captured");

      // Replay of the exact same webhook (duplicate delivery)
      const call2 = createMockReqRes({
        secret: webhookSecret,
        signature: validSignature,
        rawBody,
        body: eventPayload,
        headers: { "x-razorpay-event-id": "evt_test_captured_01" },
        db,
      });

      await POST(call2.req, call2.res);
      expect(call2.getStatus()).toBe(200);
      expect(call2.getBody().received).toBe(true);
      expect(call2.getBody().duplicate).toBe(true);

      // Verify no second audit row was inserted
      const auditRowsAfter = await db("audit_event").where({ entity_id: "pay_captured_01" });
      expect(auditRowsAfter.length).toBe(1);
    } finally {
      await dispose();
    }
  });

  it("handles payment.failed webhook gracefully and records audit", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const eventPayload = {
        id: "evt_test_failed_02",
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_failed_02",
              order_id: "order_rzp_02",
              amount: 199900,
              status: "failed",
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Payment failed due to insufficient funds",
            },
          },
        },
      };

      const rawBody = Buffer.from(JSON.stringify(eventPayload));
      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const call = createMockReqRes({
        secret: webhookSecret,
        signature: validSignature,
        rawBody,
        body: eventPayload,
        db,
      });

      await POST(call.req, call.res);
      expect(call.getStatus()).toBe(200);
      expect(call.getBody().received).toBe(true);

      const auditRows = await db("audit_event").where({ entity_id: "pay_failed_02" });
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].action).toBe("payment.failed");
      expect(auditRows[0].changes.error_code).toBe("BAD_REQUEST_ERROR");
    } finally {
      await dispose();
    }
  });
});
