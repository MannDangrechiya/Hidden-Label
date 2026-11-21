import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import {
  claimShipmentOperation,
  completeShipmentOperation,
  failShipmentOperation,
} from "./shipment-operations";

describe("Shipment Operations Mutex & Idempotency (Integration)", () => {
  let iso: IsolatedDatabase;

  beforeEach(async () => {
    iso = await createIsolatedDatabase();
  });

  afterEach(async () => {
    await iso.dispose();
  });

  it("claims an operation atomically on first attempt", async () => {
    const res = await claimShipmentOperation(iso.db, {
      orderId: "order_test_01",
      fulfillmentId: "ful_test_01",
    });

    expect(res.state).toBe("claimed");
    if (res.state === "claimed") {
      expect(res.operationId).toMatch(/^shpop_/);
      expect(res.idempotencyKey).toMatch(/^ship_op_/);
    }
  });

  it("returns in_progress for concurrent claims while operation is pending", async () => {
    const claim1 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_02",
      fulfillmentId: "ful_test_02",
    });
    expect(claim1.state).toBe("claimed");

    const claim2 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_02",
      fulfillmentId: "ful_test_02",
    });
    expect(claim2.state).toBe("in_progress");
  });

  it("returns duplicate when operation has completed", async () => {
    const claim1 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_03",
      fulfillmentId: "ful_test_03",
    });
    expect(claim1.state).toBe("claimed");

    if (claim1.state === "claimed") {
      await completeShipmentOperation(iso.db, claim1.operationId, {
        shipmentId: "shp_created_01",
        awb: "SRMOCK-AWB-100",
        courier: "Delhivery Surface",
      });
    }

    const claim2 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_03",
      fulfillmentId: "ful_test_03",
    });

    expect(claim2.state).toBe("duplicate");
    if (claim2.state === "duplicate") {
      expect(claim2.shipmentId).toBe("shp_created_01");
      expect(claim2.awb).toBe("SRMOCK-AWB-100");
    }
  });

  it("recovers stale pending operations older than timeout", async () => {
    const claim1 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_04",
      fulfillmentId: "ful_test_04",
    });
    expect(claim1.state).toBe("claimed");

    // Manually backdate the created_at timestamp to simulate 60s crash
    await iso.db("shipment_operation")
      .where({ order_id: "order_test_04" })
      .update({
        created_at: new Date(Date.now() - 60_000),
      });

    const claim2 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_04",
      fulfillmentId: "ful_test_04",
      staleTimeoutMs: 45_000,
    });

    // Should reclaim the lock rather than blocking forever
    expect(claim2.state).toBe("claimed");
  });

  it("allows safe retries after failed operations", async () => {
    const claim1 = await claimShipmentOperation(iso.db, {
      orderId: "order_test_05",
      fulfillmentId: "ful_test_05",
    });
    expect(claim1.state).toBe("claimed");

    if (claim1.state === "claimed") {
      await failShipmentOperation(iso.db, claim1.operationId, "Pincode unserviceable error");
    }

    const retryRefused = await claimShipmentOperation(iso.db, {
      orderId: "order_test_05",
      fulfillmentId: "ful_test_05",
      allowRetry: false,
    });
    expect(retryRefused.state).toBe("failed");

    const retryAllowed = await claimShipmentOperation(iso.db, {
      orderId: "order_test_05",
      fulfillmentId: "ful_test_05",
      allowRetry: true,
    });
    expect(retryAllowed.state).toBe("claimed");
  });
});
