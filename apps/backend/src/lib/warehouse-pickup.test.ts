import { describe, it, expect } from "vitest";
import { validateWarehousePickupDetails } from "./warehouse-pickup";

describe("Warehouse Pickup Configuration (Unit)", () => {
  it("validates complete warehouse pickup records", () => {
    const valid = validateWarehousePickupDetails({
      pickup_location_nickname: "Primary Warehouse",
      contact_person: "Logistics Manager",
      phone: "+919876543210",
      address_line1: "Sindhu Bhavan Road, Bodakdev",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380054",
    });

    expect(valid.valid).toBe(true);
    expect(valid.missingFields).toHaveLength(0);
  });

  it("flags missing mandatory fields", () => {
    const invalid = validateWarehousePickupDetails({
      pickup_location_nickname: "",
      contact_person: "",
      phone: "",
      address_line1: "Somewhere",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "123", // Invalid PIN code
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.missingFields).toContain("pickup_location_nickname");
    expect(invalid.missingFields).toContain("contact_person");
    expect(invalid.missingFields).toContain("phone");
    expect(invalid.missingFields).toContain("pincode (6-digit Indian PIN required)");
  });
});
