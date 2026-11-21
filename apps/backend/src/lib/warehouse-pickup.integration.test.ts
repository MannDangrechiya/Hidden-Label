import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import {
  resolveWarehousePickup,
  upsertWarehousePickupLocation,
} from "./warehouse-pickup";

describe("Warehouse Pickup Resolution (Integration)", () => {
  let iso: IsolatedDatabase;

  beforeEach(async () => {
    iso = await createIsolatedDatabase();
  });

  afterEach(async () => {
    await iso.dispose();
  });

  it("fails safely when no active warehouse is configured", async () => {
    const res = await resolveWarehousePickup(iso.db, { stockLocationId: "sloc_unknown" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NO_ACTIVE_WAREHOUSE");
      expect(res.status).toBe(422);
    }
  });

  it("resolves exact stock location match", async () => {
    await upsertWarehousePickupLocation(iso.db, {
      stockLocationId: "sloc_mumbai",
      pickupLocationCode: "MUMBAI_CENTRAL",
      pickupLocationNickname: "Mumbai Hub",
      companyName: "The Hidden Label Express",
      contactPerson: "Karan Patel",
      email: "mumbai@thehiddenlabel.com",
      phone: "+919876543210",
      addressLine1: "Bandra Kurla Complex",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400051",
      isDefault: false,
    });

    const res = await resolveWarehousePickup(iso.db, { stockLocationId: "sloc_mumbai" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.location.pickup_location_code).toBe("MUMBAI_CENTRAL");
      expect(res.source).toBe("exact_location_match");
    }
  });

  it("falls back to single default active warehouse", async () => {
    await upsertWarehousePickupLocation(iso.db, {
      stockLocationId: "sloc_ahmedabad",
      pickupLocationCode: "AHMEDABAD_HQ",
      pickupLocationNickname: "Primary Warehouse",
      companyName: "The Hidden Label Logistics",
      contactPerson: "Warehouse Lead",
      email: "logistics@thehiddenlabel.com",
      phone: "+919876543211",
      addressLine1: "Sindhu Bhavan Road, Bodakdev",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380054",
      isDefault: true,
    });

    const res = await resolveWarehousePickup(iso.db, {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.location.pickup_location_code).toBe("AHMEDABAD_HQ");
      expect(res.source).toBe("default_warehouse");
    }
  });

  it("fails with 422 if mandatory fields are missing on warehouse record", async () => {
    // Insert incomplete record directly
    await iso.db("warehouse_pickup_location").insert({
      id: "wploc_incomplete",
      stock_location_id: "sloc_bad",
      pickup_location_code: "BAD_LOC",
      pickup_location_nickname: "", // Empty nickname
      company_name: "Bad Corp",
      contact_person: "Someone",
      email: "bad@example.com",
      phone: "123",
      address_line1: "Road",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      is_default: true,
      is_active: true,
    });

    const res = await resolveWarehousePickup(iso.db, { stockLocationId: "sloc_bad" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("MISSING_MANDATORY_FIELDS");
    }
  });
});
