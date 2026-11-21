import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { ShiprocketClient, ShiprocketApiError } from "./client";
import { ShiprocketSandboxServer } from "./sandbox-server";

describe("ShiprocketClient (Unit & Isolated Sandbox)", () => {
  const sandbox = new ShiprocketSandboxServer({ port: 9097 });
  let client: ShiprocketClient;

  beforeAll(async () => {
    await sandbox.start();
  });

  afterAll(async () => {
    await sandbox.stop();
  });

  beforeEach(() => {
    sandbox.reset();
    client = new ShiprocketClient({
      baseUrl: sandbox.getUrl(),
      email: "operations@thehiddenlabel.com",
      password: "sandbox_secret_123",
      timeoutMs: 2000,
      maxRetries: 1,
    });
  });

  it("authenticates and caches the bearer token", async () => {
    const auth1 = await client.login();
    expect(auth1.token).toMatch(/^mock_jwt_token_/);

    // Second call should return cached token without throwing
    const auth2 = await client.login();
    expect(auth2.token).toBe(auth1.token);
  });

  it("fails closed on invalid credentials", async () => {
    const badClient = new ShiprocketClient({
      baseUrl: sandbox.getUrl(),
      email: "wrong@example.com",
      password: "bad_password",
    });

    await expect(badClient.login()).rejects.toThrow(ShiprocketApiError);
  });

  it("queries serviceability for serviceable pin codes", async () => {
    const res = await client.checkServiceability({
      pickup_postcode: "380054",
      delivery_postcode: "400050",
      weight: 1.2,
      cod: 0,
    });

    expect(res.status).toBe(200);
    expect(res.data.available_courier_companies.length).toBeGreaterThan(0);
    expect(res.data.recommended_courier_company_id).toBe(24);
  });

  it("returns empty courier list for unserviceable pin codes", async () => {
    const res = await client.checkServiceability({
      pickup_postcode: "380054",
      delivery_postcode: "999999", // Mock unserviceable pin
      weight: 1.0,
    });

    expect(res.status).toBe(200);
    expect(res.data.available_courier_companies).toHaveLength(0);
  });

  it("fetches registered pickup locations", async () => {
    const locations = await client.getPickupLocations();
    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].pickup_location).toBe("Primary Warehouse");
  });

  it("creates an outbound forwarding order and receives order_id and shipment_id", async () => {
    const orderRes = await client.createOrder({
      order_id: "THL-TEST-01",
      order_date: "2026-11-21 14:00",
      pickup_location: "Primary Warehouse",
      billing_customer_name: "Asha",
      billing_address: "123 High Street",
      billing_city: "Mumbai",
      billing_pincode: "400050",
      billing_state: "Maharashtra",
      billing_country: "India",
      billing_email: "asha@example.com",
      billing_phone: "9876543210",
      shipping_is_billing: true,
      order_items: [
        {
          name: "Luxury Silk Scarf",
          sku: "THL-SILK-01",
          units: 1,
          selling_price: 15000,
        },
      ],
      payment_method: "Prepaid",
      sub_total: 15000,
      length: 20,
      breadth: 15,
      height: 5,
      weight: 0.5,
    });

    expect(orderRes.order_id).toBeGreaterThan(0);
    expect(orderRes.shipment_id).toBeGreaterThan(0);
    expect(orderRes.status).toBe("NEW");
  });

  it("assigns AWB to a created shipment", async () => {
    const orderRes = await client.createOrder({
      order_id: "THL-TEST-02",
      order_date: "2026-11-21 14:00",
      pickup_location: "Primary Warehouse",
      billing_customer_name: "Karan",
      billing_address: "45 Marine Drive",
      billing_city: "Mumbai",
      billing_pincode: "400020",
      billing_state: "Maharashtra",
      billing_country: "India",
      billing_email: "karan@example.com",
      billing_phone: "9876543211",
      shipping_is_billing: true,
      order_items: [
        {
          name: "Cashmere Sweater",
          sku: "THL-CSHM-01",
          units: 1,
          selling_price: 24000,
        },
      ],
      payment_method: "Prepaid",
      sub_total: 24000,
      length: 25,
      breadth: 20,
      height: 8,
      weight: 0.8,
    });

    const awbRes = await client.assignAwb({
      shipment_id: orderRes.shipment_id,
      courier_id: 24,
    });

    expect(awbRes.response.data.awb_code).toMatch(/^SRMOCK/);
    expect(awbRes.response.data.courier_name).toContain("Delhivery");
  });

  it("generates shipping label PDF URL", async () => {
    const labelRes = await client.generateLabel([200001]);
    expect(labelRes.label_created).toBe(1);
    expect(labelRes.label_url).toContain(".pdf");
  });

  it("tracks shipment by AWB code", async () => {
    const trackRes = await client.trackAwb("SRMOCK-TEST-AWB-01");
    expect(trackRes.tracking_data.track_status).toBe(1);
    expect(trackRes.tracking_data.shipment_track).toHaveLength(1);
  });

  it("cancels an order by ID", async () => {
    const cancelRes = await client.cancelOrder([100001]);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.message).toContain("cancelled");
  });

  it("creates a reverse return order with return AWB", async () => {
    const returnRes = await client.createReturn({
      order_id: "RMA-1099",
      order_date: "2026-11-21",
      pickup_customer_name: "Asha",
      pickup_address: "123 High Street",
      pickup_city: "Mumbai",
      pickup_state: "Maharashtra",
      pickup_country: "India",
      pickup_pincode: "400050",
      pickup_email: "asha@example.com",
      pickup_phone: "9876543210",
      shipping_customer_name: "The Hidden Label Returns",
      shipping_address: "Sindhu Bhavan Road, Bodakdev",
      shipping_city: "Ahmedabad",
      shipping_state: "Gujarat",
      shipping_country: "India",
      shipping_pincode: "380054",
      shipping_phone: "9876543210",
      order_items: [
        {
          name: "Silk Scarf",
          sku: "THL-SILK-01",
          units: 1,
          selling_price: 15000,
        },
      ],
      sub_total: 15000,
      length: 20,
      breadth: 15,
      height: 5,
      weight: 0.5,
    });

    expect(returnRes.order_id).toBeGreaterThan(0);
    expect(returnRes.awb_code).toMatch(/^SRREV/);
  });

  it("simulates timeout and handles error cleanly", async () => {
    sandbox.setDelayMs(3000); // Exceeds client timeoutMs of 2000
    const timeoutClient = new ShiprocketClient({
      baseUrl: sandbox.getUrl(),
      email: "operations@thehiddenlabel.com",
      password: "sandbox_secret_123",
      timeoutMs: 500,
      maxRetries: 0,
    });

    await expect(timeoutClient.login()).rejects.toThrow("Request timed out");
  });
});
