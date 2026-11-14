import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { Logger } from "@medusajs/framework/types";
import RazorpayPaymentProviderService from "./service";
import { PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils";

describe("RazorpayPaymentProviderService (apps/backend/src/modules/razorpay/service.ts)", () => {
  const dummyLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  } as unknown as Logger;

  const keySecret = "secret_key_test_123456";
  const webhookSecret = "webhook_secret_test_789";

  const service = new RazorpayPaymentProviderService(
    { logger: dummyLogger },
    {
      key_id: "rzp_test_12345",
      key_secret: keySecret,
      webhook_secret: webhookSecret,
    },
  );

  describe("authorizePayment signature verification", () => {
    it("returns AUTHORIZED when the HMAC-SHA256 checkout signature matches", async () => {
      const orderId = "order_rzp_001";
      const paymentId = "pay_rzp_001";
      const validSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const result = await service.authorizePayment({
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        },
      });

      expect(result.status).toBe(PaymentSessionStatus.AUTHORIZED);
      expect((result.data as Record<string, unknown>)?.verified_at).toBeDefined();
    });

    it("returns ERROR when checkout signature does not match", async () => {
      const orderId = "order_rzp_001";
      const paymentId = "pay_rzp_001";
      const invalidSignature = "invalid_tampered_signature";

      const result = await service.authorizePayment({
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: invalidSignature,
        },
      });

      expect(result.status).toBe(PaymentSessionStatus.ERROR);
    });

    it("returns PENDING if checkout has not completed in browser yet", async () => {
      const result = await service.authorizePayment({
        data: {
          razorpay_order_id: "order_rzp_001",
        },
      });

      expect(result.status).toBe(PaymentSessionStatus.PENDING);
    });
  });

  describe("getWebhookActionAndData webhook verification", () => {
    it("verifies rawData against webhook_secret and maps payment.captured to SUCCESSFUL", async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          event: "payment.captured",
          payload: {
            payment: {
              entity: {
                id: "pay_123",
                order_id: "order_123",
                amount: 3899000,
              },
            },
          },
        }),
      );

      const validSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      const actionResult = await service.getWebhookActionAndData({
        rawData: rawBody,
        data: JSON.parse(rawBody.toString()),
        headers: {
          "x-razorpay-signature": validSignature,
        },
      });

      expect(actionResult.action).toBe(PaymentActions.SUCCESSFUL);
      expect(actionResult.data).toEqual({ session_id: "order_123", amount: 3899000 });
    });

    it("ignores webhook with invalid signature", async () => {
      const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      const actionResult = await service.getWebhookActionAndData({
        rawData: rawBody,
        data: {},
        headers: {
          "x-razorpay-signature": "forged_signature",
        },
      });

      expect(actionResult.action).toBe(PaymentActions.NOT_SUPPORTED);
    });
  });
});
