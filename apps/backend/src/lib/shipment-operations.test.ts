import { describe, it, expect } from "vitest";
import { deriveShipmentIdempotencyKey } from "./shipment-operations";

describe("Shipment Operations (Unit)", () => {
  it("derives deterministic SHA-256 idempotency key", () => {
    const key1 = deriveShipmentIdempotencyKey("order_123", "ful_abc", "dispatch_shiprocket");
    const key2 = deriveShipmentIdempotencyKey("order_123", "ful_abc", "dispatch_shiprocket");
    expect(key1).toMatch(/^ship_op_[a-f0-9]{64}$/);
    expect(key1).toBe(key2);

    const key3 = deriveShipmentIdempotencyKey("order_124", "ful_abc", "dispatch_shiprocket");
    expect(key1).not.toBe(key3);
  });
});
