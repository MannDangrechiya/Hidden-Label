import { describe, expect, it } from "vitest";
import { createIsolatedDatabase } from "../../test/integration-db";
import {
  claimPaymentOperation,
  completePaymentOperation,
  derivePaymentIdempotencyKey,
  failPaymentOperation,
  getCompletedOperationByCart,
} from "./payment-operations";
import { recordWebhookEvent, isWebhookEventProcessed } from "./webhook-tracking";

describe("Payment operations and idempotency (Phase 2)", () => {
  it("derives deterministic sha256 idempotency key", () => {
    const key1 = derivePaymentIdempotencyKey("cart_123", "order_rzp_456", "pay_rzp_789");
    const key2 = derivePaymentIdempotencyKey("cart_123", "order_rzp_456", "pay_rzp_789");
    const keyDiff = derivePaymentIdempotencyKey("cart_123", "order_rzp_456", "pay_rzp_999");

    expect(key1).toMatch(/^pay_op_[0-9a-f]{64}$/);
    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDiff);
  });

  it("handles concurrent payment claims: exactly one wins and claims the operation", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const cartId = "cart_concurrency_01";
      const rzpOrderId = "order_rzp_01";
      const rzpPaymentId = "pay_rzp_01";

      const claims = await Promise.all(
        Array.from({ length: 10 }, () =>
          claimPaymentOperation(db, {
            cartId,
            razorpayOrderId: rzpOrderId,
            razorpayPaymentId: rzpPaymentId,
            amountPaise: 499900,
          }),
        ),
      );

      const claimed = claims.filter((c) => c.state === "claimed");
      const inProgress = claims.filter((c) => c.state === "in_progress");

      expect(claimed.length).toBe(1);
      expect(inProgress.length).toBe(9);

      // Verify database row
      const rows = await db("payment_operation").where({ cart_id: cartId });
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("pending");
      expect(rows[0].amount).toBe(499900);
    } finally {
      await dispose();
    }
  });

  it("returns duplicate with orderId when checkout is already completed", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const cartId = "cart_duplicate_02";
      const rzpOrderId = "order_rzp_02";
      const rzpPaymentId = "pay_rzp_02";

      const claim1 = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 1250000,
      });

      expect(claim1.state).toBe("claimed");
      await completePaymentOperation(db, claim1.idempotencyKey, "order_created_02");

      // Repeated request after completion
      const claim2 = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 1250000,
      });

      expect(claim2.state).toBe("duplicate");
      if (claim2.state === "duplicate") {
        expect(claim2.orderId).toBe("order_created_02");
      }

      const lookup = await getCompletedOperationByCart(db, cartId);
      expect(lookup?.order_id).toBe("order_created_02");
    } finally {
      await dispose();
    }
  });

  it("marks operation failed and reports failure on retry", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const cartId = "cart_failed_03";
      const claim = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: "order_rzp_03",
        razorpayPaymentId: "pay_rzp_03",
        amountPaise: 350000,
      });

      expect(claim.state).toBe("claimed");
      await failPaymentOperation(db, claim.idempotencyKey, "Signature verification failed");

      const retry = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: "order_rzp_03",
        razorpayPaymentId: "pay_rzp_03",
        amountPaise: 350000,
      });

      expect(retry.state).toBe("failed");
      if (retry.state === "failed") {
        expect(retry.error).toContain("Signature verification failed");
      }

      // Explicit retry with allowRetry: true reclaims the lock
      const retryAllowed = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: "order_rzp_03",
        razorpayPaymentId: "pay_rzp_03",
        amountPaise: 350000,
        allowRetry: true,
      });

      expect(retryAllowed.state).toBe("claimed");
    } finally {
      await dispose();
    }
  });

  it("recovers interrupted operation when order was already committed in order_cart", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const cartId = "cart_interrupted_04";
      const rzpOrderId = "order_rzp_04";
      const rzpPaymentId = "pay_rzp_04";

      // 1. First claim succeeds (operation status pending)
      const claim1 = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 890000,
      });
      expect(claim1.state).toBe("claimed");

      // 2. Simulate order committed in order_cart right before worker crashed
      await db("order").insert({
        id: "order_committed_04",
        currency_code: "inr",
      });
      await db("order_cart").insert({
        order_id: "order_committed_04",
        cart_id: cartId,
      });

      // 3. New request arrives: recovery detects order_cart row and returns duplicate with orderId
      const claimRecovered = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 890000,
      });

      expect(claimRecovered.state).toBe("duplicate");
      if (claimRecovered.state === "duplicate") {
        expect(claimRecovered.orderId).toBe("order_committed_04");
      }

      const opRow = await db("payment_operation").where({ cart_id: cartId }).first();
      expect(opRow?.status).toBe("completed");
      expect(opRow?.order_id).toBe("order_committed_04");
    } finally {
      await dispose();
    }
  });

  it("reclaims stale lock after worker timeout when no order was created", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const cartId = "cart_stale_05";
      const rzpOrderId = "order_rzp_05";
      const rzpPaymentId = "pay_rzp_05";

      // 1. First claim succeeds
      const claim1 = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 650000,
      });
      expect(claim1.state).toBe("claimed");

      // 2. Second request immediately returns in_progress
      const claimImmediate = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 650000,
      });
      expect(claimImmediate.state).toBe("in_progress");

      // 3. Set updated_at to 60 seconds ago (stale timeout exceeded)
      const past = new Date(Date.now() - 60_000);
      await db("payment_operation")
        .where({ cart_id: cartId })
        .update({ updated_at: past, created_at: past });

      // 4. Stale recovery allows re-claiming
      const claimStale = await claimPaymentOperation(db, {
        cartId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        amountPaise: 650000,
        staleTimeoutMs: 30_000,
      });

      expect(claimStale.state).toBe("claimed");
    } finally {
      await dispose();
    }
  });

  it("deduplicates concurrent and repeated webhook deliveries", async () => {
    const { db, dispose } = await createIsolatedDatabase();
    try {
      const eventId = "evt_payment_captured_12345";
      const payloadHash = "sha256_mock_hash_for_body_12345";

      // 10 racing webhook deliveries
      const deliveries = await Promise.all(
        Array.from({ length: 10 }, () =>
          recordWebhookEvent(db, {
            eventId,
            provider: "razorpay",
            eventType: "payment.captured",
            entityId: "pay_12345",
            payloadHash,
          }),
        ),
      );

      const recorded = deliveries.filter((d) => d.recorded);
      const duplicates = deliveries.filter((d) => d.duplicate);

      expect(recorded.length).toBe(1);
      expect(duplicates.length).toBe(9);

      // Verify database
      const rows = await db("webhook_event").where({ event_id: eventId });
      expect(rows.length).toBe(1);
      expect(rows[0].entity_id).toBe("pay_12345");

      // Check helper
      const isProcessed = await isWebhookEventProcessed(db, eventId);
      expect(isProcessed).toBe(true);
    } finally {
      await dispose();
    }
  });
});
