import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import {
  claimRefundOperation,
  markRefundOperationCompleted,
  reclaimFailedRefundOperation,
  refundOperationKey,
  type ClaimRefundInput,
} from "./refund-operations";

let iso: IsolatedDatabase;

const intent: ClaimRefundInput = {
  orderId: "order_concurrent",
  paymentId: "pay_concurrent",
  amount: 21999,
  reason: "Customer changed their mind",
  actorId: "user_ops",
};

beforeAll(async () => {
  iso = await createIsolatedDatabase();
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Concurrent and duplicate refunds (BUG-04)", () => {
  it("lets exactly one of ten concurrent requests claim the refund", async () => {
    const claims = await Promise.all(
      Array.from({ length: 10 }, () => claimRefundOperation(iso.db, intent)),
    );

    expect(claims.filter((claim) => claim.claimed)).toHaveLength(1);
    expect(new Set(claims.map((claim) => claim.operation.idempotency_key)).size).toBe(1);

    const rows = await iso.db("refund_operation").where({ order_id: intent.orderId });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
  }, 30_000);

  it("returns the completed operation instead of creating a second refund", async () => {
    const key = refundOperationKey(intent);
    await markRefundOperationCompleted(iso.db, key, "refund_1");

    const duplicate = await claimRefundOperation(iso.db, intent);
    expect(duplicate.claimed).toBe(false);
    expect(duplicate.operation.status).toBe("completed");
    expect(duplicate.operation.refund_id).toBe("refund_1");

    const rows = await iso.db("refund_operation").where({ idempotency_key: key });
    expect(rows).toHaveLength(1);
  }, 30_000);

  it("re-opens a failed operation exactly once for a retry", async () => {
    const failing = { ...intent, amount: 1500, orderId: "order_retry" };
    const first = await claimRefundOperation(iso.db, failing);
    expect(first.claimed).toBe(true);

    const key = first.operation.idempotency_key;
    await iso.db("refund_operation").where({ idempotency_key: key }).update({ status: "failed" });

    const retries = await Promise.all(
      Array.from({ length: 5 }, () => reclaimFailedRefundOperation(iso.db, key)),
    );
    expect(retries.filter((row) => row !== null)).toHaveLength(1);
  }, 30_000);

  it("treats a different amount as a different refund intent", async () => {
    const partial = await claimRefundOperation(iso.db, {
      ...intent,
      orderId: "order_partial",
      amount: 5000,
    });
    expect(partial.claimed).toBe(true);

    const otherAmount = await claimRefundOperation(iso.db, {
      ...intent,
      orderId: "order_partial",
      amount: 6000,
    });
    expect(otherAmount.claimed).toBe(true);

    const rows = await iso.db("refund_operation").where({ order_id: "order_partial" });
    expect(rows).toHaveLength(2);
  }, 30_000);
});
