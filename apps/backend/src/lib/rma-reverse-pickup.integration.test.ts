import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { ShiprocketSandboxServer } from "../modules/shiprocket/sandbox-server";
import { ShiprocketClient } from "../modules/shiprocket/client";
import { setShiprocketClient } from "./shiprocket-provider";
import { upsertWarehousePickupLocation } from "./warehouse-pickup";
import { bookRmaReversePickup, receiveAndInspectReturn } from "./rma-reverse-pickup";

describe("RMA Reverse Pickup & Return Lifecycle (Integration)", () => {
  let iso: IsolatedDatabase;
  const sandbox = new ShiprocketSandboxServer({ port: 9096 });

  beforeEach(async () => {
    iso = await createIsolatedDatabase();
    sandbox.reset();
    await sandbox.start();

    const client = new ShiprocketClient({
      baseUrl: sandbox.getUrl(),
      email: "operations@thehiddenlabel.com",
      password: "sandbox_secret_123",
    });
    setShiprocketClient(client);

    // Seed warehouse pickup location
    await upsertWarehousePickupLocation(iso.db, {
      stockLocationId: "sloc_primary",
      pickupLocationCode: "PRIMARY_WH",
      pickupLocationNickname: "Primary Warehouse",
      companyName: "The Hidden Label Warehouse",
      contactPerson: "Inventory Lead",
      email: "warehouse@thehiddenlabel.com",
      phone: "+919876543210",
      addressLine1: "Sindhu Bhavan Road, Bodakdev",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380054",
      isDefault: true,
    });

    // Seed customer address, order, item, RMA
    await iso.db("order_address").insert({
      id: "ordaddr_rma_01",
      first_name: "Raghav",
      last_name: "Sharma",
      address_1: "Flat 402, Royal Palms",
      city: "Mumbai",
      province: "Maharashtra",
      postal_code: "400050",
      phone: "+919876543210",
    });

    await iso.db("order").insert({
      id: "order_rma_01",
      display_id: 201,
      currency_code: "inr",
      email: "raghav@example.com",
      status: "pending",
      shipping_address_id: "ordaddr_rma_01",
      total: 38990.0,
    });

    await iso.db("order_line_item").insert({
      id: "oli_rma_01",
      order_id: "order_rma_01",
      variant_id: "var_shoe_01",
      product_title: "Jordan 1 Retro High OG",
      variant_sku: "J1-RETRO-01",
      unit_price: 38990.0,
    });

    await iso.db("return_request").insert({
      id: "rma_test_01",
      display_id: "RMA-2001",
      order_id: "order_rma_01",
      status: "approved",
      reason_code: "size_too_small",
      refund_amount: 38990.0,
    });

    await iso.db("return_request_item").insert({
      id: "rri_01",
      return_request_id: "rma_test_01",
      order_item_id: "oli_rma_01",
      quantity: 1,
    });

    // Seed stock inventory
    await iso.db("product_variant_inventory_item").insert({
      variant_id: "var_shoe_01",
      inventory_item_id: "iitem_shoe_01",
    });

    await iso.db("stock_location").insert({
      id: "sloc_primary",
      name: "Primary Warehouse",
    });

    await iso.db("inventory_level").insert({
      id: "ilev_shoe_01",
      inventory_item_id: "iitem_shoe_01",
      location_id: "sloc_primary",
      stocked_quantity: 5,
      reserved_quantity: 0,
    });
  });

  afterEach(async () => {
    setShiprocketClient(null);
    await sandbox.stop();
    await iso.dispose();
  });

  it("books reverse pickup with Shiprocket and assigns reverse AWB", async () => {
    const res = await bookRmaReversePickup(iso.db, {
      returnRequestId: "rma_test_01",
      weightKg: 1.2,
      actorId: "admin_test",
    });

    expect(res.ok).toBe(true);
    expect(res.duplicate).toBe(false);
    expect(res.awb).toMatch(/^SRREV/);

    // Verify DB update
    const updated = await iso.db("return_request").where({ id: "rma_test_01" }).first();
    expect(updated.awb).toBe(res.awb);
    expect(updated.status).toBe("pickup_scheduled");
  });

  it("prevents duplicate reverse pickup requests", async () => {
    const res1 = await bookRmaReversePickup(iso.db, {
      returnRequestId: "rma_test_01",
      weightKg: 1.2,
    });

    const res2 = await bookRmaReversePickup(iso.db, {
      returnRequestId: "rma_test_01",
      weightKg: 1.2,
    });

    expect(res2.duplicate).toBe(true);
    expect(res2.awb).toBe(res1.awb);
  });

  it("receives return and restocks inventory when condition is resellable", async () => {
    const res = await receiveAndInspectReturn(iso.db, {
      returnRequestId: "rma_test_01",
      condition: "resellable",
      conditionNote: "Pristine box and unworn shoes",
      locationId: "sloc_primary",
      actorId: "inspector_01",
    });

    expect(res.restock?.restocked).toBe(true);
    expect(res.restock?.units).toBe(1);

    // Inventory should have increased from 5 to 6
    const inv = await iso.db("inventory_level").where({ id: "ilev_shoe_01" }).first();
    expect(inv.stocked_quantity).toBe(6);

    // Second call should NOT restock again (already_restocked check)
    const res2 = await receiveAndInspectReturn(iso.db, {
      returnRequestId: "rma_test_01",
      condition: "resellable",
      locationId: "sloc_primary",
      actorId: "inspector_01",
    });

    expect(res2.restock?.restocked).toBe(false);
    expect(res2.restock?.reason).toBe("already_restocked");
  });

  it("does not restock inventory when return condition is damaged", async () => {
    const res = await receiveAndInspectReturn(iso.db, {
      returnRequestId: "rma_test_01",
      condition: "damaged",
      conditionNote: "Sole worn and box crushed",
      locationId: "sloc_primary",
      actorId: "inspector_01",
    });

    expect(res.restock).toBeNull();

    // Inventory remains unchanged at 5
    const inv = await iso.db("inventory_level").where({ id: "ilev_shoe_01" }).first();
    expect(inv.stocked_quantity).toBe(5);
  });
});
