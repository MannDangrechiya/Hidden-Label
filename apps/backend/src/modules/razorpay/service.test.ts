import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { Logger } from "@medusajs/framework/types";
import RazorpayPaymentProviderService from "./service";
import { PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils";
import { RazorpaySandboxServer } from "./sandbox-server";

describe("RazorpayPaymentProviderService (apps/backend/src/modules/razorpay/service.ts)", () => {
  const dummyLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  } as unknown as Logger;

  const keyId = "rzp_test_service_suite";
  const keySecret = "secret_key_test_123456";
  const webhookSecret = "webhook_secret_test_789";

  let sandbox: RazorpaySandboxServer;
  let service: RazorpayPaymentProviderService;

  beforeAll(async () => {
    sandbox = new RazorpaySandboxServer(keySecret, webhookSecret);
    const port = await sandbox.start(0);

    service = new RazorpayPaymentProviderService(
      { logger: dummyLogger },
      {
        key_id: keyId,
        key_secret: keySecret,
        webhook_secret: webhookSecret,
        api_url: `http://127.0.0.1:${port}/v1`,
      },
    );
  });

  afterAll(async () => {
    await sandbox.stop();
  });

  describe("initiatePayment", () => {
    it("creates a Razorpay order with server-calculated amount and session_id in notes", async () => {
      const output = await service.initiatePayment({
        amount: 5499,
        currency_code: "inr",
        data: { session_id: "payses_unit_test_01" },
        context: {
          customer: { id: "cus_01", email: "client@example.test" },
        },
      });

      expect(output.status).toBe(PaymentSessionStatus.PENDING);
      expect(output.id).toMatch(/^order_test_/);
      expect(output.data?.amount).toBe(549900);
      expect(output.data?.razorpay_order_id).toBe(output.id);

      // Verify sandbox order stored notes
      const order = sandbox.orders.get(output.id);
      expect(order).toBeDefined();
      expect(order?.amount).toBe(549900);
      expect(order?.notes?.session_id).toBe("payses_unit_test_01");
      expect(order?.notes?.customer_email).toBe("client@example.test");
    });
  });

  describe("authorizePayment", () => {
    it("returns AUTHORIZED when HMAC signature matches AND Razorpay amount is verified", async () => {
      // 1. Create order for ₹7,500.00
      const init = await service.initiatePayment({
        amount: 7500,
        currency_code: "inr",
        data: { session_id: "payses_auth_01" },
      });
      const orderId = init.id;

      // 2. Simulate customer payment in modal (750000 paise)
      const { paymentId, signature } = sandbox.simulateSuccessfulPayment(orderId, 750000);

      // 3. Authorize payment
      const result = await service.authorizePayment({
        amount: 7500,
        currency_code: "inr",
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amount: 750000,
        },
      });

      expect(result.status).toBe(PaymentSessionStatus.AUTHORIZED);
      expect((result.data as Record<string, unknown>)?.verified_at).toBeDefined();
      expect((result.data as Record<string, unknown>)?.verified_amount).toBe(750000);
    });

    it("returns ERROR when signature is forged or invalid", async () => {
      const init = await service.initiatePayment({
        amount: 3000,
        currency_code: "inr",
      });
      const orderId = init.id;
      const { paymentId } = sandbox.simulateSuccessfulPayment(orderId, 300000);

      const result = await service.authorizePayment({
        amount: 3000,
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: "forged_invalid_signature_hex",
        },
      });

      expect(result.status).toBe(PaymentSessionStatus.ERROR);
    });

    it("returns ERROR and blocks authorization when amount manipulation is attempted", async () => {
      // Cart total is ₹50,000 (5,000,000 paise)
      const init = await service.initiatePayment({
        amount: 50000,
        currency_code: "inr",
      });
      const orderId = init.id;

      // Attacker attempts to pay ₹100 (10,000 paise) instead of ₹50,000
      const paymentId = `pay_tampered_${crypto.randomBytes(6).toString("hex")}`;
      sandbox.payments.set(paymentId, {
        id: paymentId,
        order_id: orderId,
        amount: 10000, // Tampered amount!
        currency: "INR",
        status: "authorized",
        created_at: Math.floor(Date.now() / 1000),
      });

      const validSigForTamperedPayment = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const result = await service.authorizePayment({
        amount: 50000, // Medusa expects ₹50,000
        data: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSigForTamperedPayment,
          amount: 5000000,
        },
      });

      // Authorization must fail!
      expect(result.status).toBe(PaymentSessionStatus.ERROR);
      expect((result.data as Record<string, unknown>)?.error).toBe("amount_mismatch");
    });

    it("returns PENDING when payment details have not arrived from browser yet", async () => {
      const result = await service.authorizePayment({
        data: {
          razorpay_order_id: "order_pending_123",
        },
      });

      expect(result.status).toBe(PaymentSessionStatus.PENDING);
    });
  });

  describe("capturePayment", () => {
    it("captures payment idempotently without throwing on duplicate capture", async () => {
      const init = await service.initiatePayment({
        amount: 2500,
        currency_code: "inr",
      });
      const { paymentId } = sandbox.simulateSuccessfulPayment(init.id, 250000);

      // 1st capture
      const cap1 = await service.capturePayment({
        data: { razorpay_payment_id: paymentId, amount: 250000, currency_code: "INR" },
      });
      expect(cap1.data.captured).toBeDefined();

      // 2nd capture (duplicate) -> must be idempotent and succeed without error
      const cap2 = await service.capturePayment({
        data: { razorpay_payment_id: paymentId, amount: 250000, currency_code: "INR" },
      });
      expect(cap2.data.captured).toBeDefined();
    });
  });

  describe("getWebhookActionAndData", () => {
    it("verifies webhook signature and maps payment.captured with session_id", async () => {
      const delivery = sandbox.generateWebhookDelivery(
        "payment.captured",
        "pay_wh_01",
        "order_wh_01",
        189900,
        { session_id: "payses_mapped_01" },
      );

      const actionResult = await service.getWebhookActionAndData({
        rawData: delivery.rawBody,
        data: delivery.body,
        headers: {
          "x-razorpay-signature": delivery.signature,
        },
      });

      expect(actionResult.action).toBe(PaymentActions.SUCCESSFUL);
      expect(actionResult.data).toEqual({ session_id: "payses_mapped_01", amount: 189900 });
    });

    it("rejects forged webhook signature", async () => {
      const delivery = sandbox.generateWebhookDelivery("payment.captured", "pay_wh_02", "order_wh_02", 50000);

      const actionResult = await service.getWebhookActionAndData({
        rawData: delivery.rawBody,
        data: delivery.body,
        headers: {
          "x-razorpay-signature": "forged_webhook_sig_hex_000000000000000000000000000000000000000000000000000000000000",
        },
      });

      expect(actionResult.action).toBe(PaymentActions.NOT_SUPPORTED);
    });

    it("maps payment.failed webhook to FAILED action", async () => {
      const delivery = sandbox.generateWebhookDelivery(
        "payment.failed",
        "pay_wh_fail",
        "order_wh_fail",
        99900,
        { session_id: "payses_failed_01" },
      );

      const actionResult = await service.getWebhookActionAndData({
        rawData: delivery.rawBody,
        data: delivery.body,
        headers: {
          "x-razorpay-signature": delivery.signature,
        },
      });

      expect(actionResult.action).toBe(PaymentActions.FAILED);
      expect(actionResult.data).toEqual({ session_id: "payses_failed_01", amount: 99900 });
    });
  });
});
