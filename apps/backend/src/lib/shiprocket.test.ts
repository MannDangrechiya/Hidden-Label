import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("shiprocket client (apps/backend/src/lib/shiprocket.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SHIPROCKET_EMAIL;
    delete process.env.SHIPROCKET_PASSWORD;
    delete process.env.SHIPROCKET_PICKUP_LOCATION;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("isConfigured is false with no credentials", async () => {
    const { isConfigured } = await import("./shiprocket");
    expect(isConfigured()).toBe(false);
  });

  it("isConfigured is true once email and password are set", async () => {
    process.env.SHIPROCKET_EMAIL = "ops@thehiddenlabel.com";
    process.env.SHIPROCKET_PASSWORD = "secret";
    const { isConfigured } = await import("./shiprocket");
    expect(isConfigured()).toBe(true);
  });

  it("createShiprocketOrder throws (never silently succeeds) when not configured", async () => {
    const { createShiprocketOrder } = await import("./shiprocket");
    await expect(
      createShiprocketOrder({
        orderId: "order_1",
        orderDisplayId: "1",
        orderDate: new Date().toISOString(),
        customerName: "Test Customer",
        addressLine1: "1 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        phone: "+919876543210",
        email: "buyer@example.com",
        items: [{ name: "Test Sneaker", sku: "SKU-1", units: 1, selling_price: 1000 }],
        subTotalRupees: 1000,
        paymentMethod: "COD",
      }),
    ).rejects.toThrow(/not configured/i);
  });

  it("returns a real result when the Shiprocket API responds successfully", async () => {
    process.env.SHIPROCKET_EMAIL = "ops@thehiddenlabel.com";
    process.env.SHIPROCKET_PASSWORD = "secret";
    process.env.SHIPROCKET_PICKUP_LOCATION = "Primary Warehouse";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "fake-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order_id: 123,
          shipment_id: 456,
          awb_code: "AWB123",
          courier_name: "Delhivery",
          label_url: "https://example.com/label.pdf",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { createShiprocketOrder } = await import("./shiprocket");
    const result = await createShiprocketOrder({
      orderId: "order_1",
      orderDisplayId: "1",
      orderDate: new Date().toISOString(),
      customerName: "Test Customer",
      addressLine1: "1 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      phone: "+919876543210",
      email: "buyer@example.com",
      items: [{ name: "Test Sneaker", sku: "SKU-1", units: 1, selling_price: 1000 }],
      subTotalRupees: 1000,
      paymentMethod: "COD",
    });

    expect(result).toEqual({
      shiprocketOrderId: "123",
      shipmentId: "456",
      awb: "AWB123",
      courierName: "Delhivery",
      labelUrl: "https://example.com/label.pdf",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws (never fabricates a result) when the Shiprocket API rejects the order", async () => {
    process.env.SHIPROCKET_EMAIL = "ops@thehiddenlabel.com";
    process.env.SHIPROCKET_PASSWORD = "secret";
    process.env.SHIPROCKET_PICKUP_LOCATION = "Primary Warehouse";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: "fake-token" }) })
      .mockResolvedValueOnce({ ok: false, status: 422, text: async () => "Invalid pincode" });
    vi.stubGlobal("fetch", fetchMock);

    const { createShiprocketOrder } = await import("./shiprocket");
    await expect(
      createShiprocketOrder({
        orderId: "order_1",
        orderDisplayId: "1",
        orderDate: new Date().toISOString(),
        customerName: "Test Customer",
        addressLine1: "1 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "000000",
        phone: "+919876543210",
        email: "buyer@example.com",
        items: [{ name: "Test Sneaker", sku: "SKU-1", units: 1, selling_price: 1000 }],
        subTotalRupees: 1000,
        paymentMethod: "COD",
      }),
    ).rejects.toThrow(/422/);
  });
});
