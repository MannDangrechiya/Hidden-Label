import type { Knex } from "knex";
import { generateEntityId } from "@medusajs/framework/utils";

export interface WarehousePickupRecord {
  id: string;
  stock_location_id: string;
  pickup_location_code: string;
  pickup_location_nickname: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type WarehouseResolutionResult =
  | {
      ok: true;
      location: WarehousePickupRecord;
      source: "exact_location_match" | "order_fulfillment_match" | "default_warehouse";
    }
  | {
      ok: false;
      code: "NO_ACTIVE_WAREHOUSE" | "MISSING_MANDATORY_FIELDS" | "MULTIPLE_AMBIGUOUS_WAREHOUSES";
      status: 422;
      message: string;
    };

/**
 * Validates that all mandatory fields required by Shiprocket are present and properly formed.
 */
export function validateWarehousePickupDetails(
  record: Partial<WarehousePickupRecord>,
): { valid: boolean; missingFields: string[] } {
  const missing: string[] = [];

  if (!record.pickup_location_nickname?.trim()) missing.push("pickup_location_nickname");
  if (!record.contact_person?.trim()) missing.push("contact_person");
  if (!record.phone?.trim()) missing.push("phone");
  if (!record.address_line1?.trim()) missing.push("address_line1");
  if (!record.city?.trim()) missing.push("city");
  if (!record.state?.trim()) missing.push("state");
  if (!record.pincode?.trim() || !/^\d{6}$/.test(record.pincode.trim())) {
    missing.push("pincode (6-digit Indian PIN required)");
  }

  return { valid: missing.length === 0, missingFields: missing };
}

/**
 * Resolves the authoritative physical warehouse pickup location for an order or stock location.
 *
 * Precedence:
 * 1. Explicit `stockLocationId` provided by operator.
 * 2. Location linked to order's existing Medusa fulfillment (via `order_fulfillment` / `fulfillment`).
 * 3. Single default active warehouse flagged with `is_default = true`.
 * 4. Refuse with 422 if ambiguous, unconfigured, or missing required courier attributes.
 */
export async function resolveWarehousePickup(
  pg: Knex,
  options: {
    stockLocationId?: string | null;
    orderId?: string | null;
  } = {},
): Promise<WarehouseResolutionResult> {
  // 1. Direct stock location match
  if (options.stockLocationId) {
    const loc = (await pg("warehouse_pickup_location")
      .where({ stock_location_id: options.stockLocationId, is_active: true })
      .first()) as WarehousePickupRecord | undefined;

    if (loc) {
      const validation = validateWarehousePickupDetails(loc);
      if (!validation.valid) {
        return {
          ok: false,
          code: "MISSING_MANDATORY_FIELDS",
          status: 422,
          message: `Warehouse location ${loc.pickup_location_code} is incomplete: missing [${validation.missingFields.join(", ")}].`,
        };
      }
      return { ok: true, location: loc, source: "exact_location_match" };
    }
  }

  // 2. Order fulfillment location match
  if (options.orderId) {
    const fulfillmentLoc = (await pg("order_fulfillment as of")
      .join("fulfillment as f", "f.id", "of.fulfillment_id")
      .where("of.order_id", options.orderId)
      .whereNull("of.deleted_at")
      .whereNull("f.deleted_at")
      .first("f.location_id")) as { location_id: string } | undefined;

    if (fulfillmentLoc?.location_id) {
      const loc = (await pg("warehouse_pickup_location")
        .where({ stock_location_id: fulfillmentLoc.location_id, is_active: true })
        .first()) as WarehousePickupRecord | undefined;

      if (loc) {
        const validation = validateWarehousePickupDetails(loc);
        if (!validation.valid) {
          return {
            ok: false,
            code: "MISSING_MANDATORY_FIELDS",
            status: 422,
            message: `Warehouse location ${loc.pickup_location_code} for order fulfillment is incomplete: missing [${validation.missingFields.join(", ")}].`,
          };
        }
        return { ok: true, location: loc, source: "order_fulfillment_match" };
      }
    }
  }

  // 3. Fallback to explicitly configured default active warehouse
  const defaultLocs = (await pg("warehouse_pickup_location")
    .where({ is_default: true, is_active: true })) as WarehousePickupRecord[];

  if (defaultLocs.length === 1) {
    const loc = defaultLocs[0];
    const validation = validateWarehousePickupDetails(loc);
    if (!validation.valid) {
      return {
        ok: false,
        code: "MISSING_MANDATORY_FIELDS",
        status: 422,
        message: `Default warehouse ${loc.pickup_location_code} is incomplete: missing [${validation.missingFields.join(", ")}].`,
      };
    }
    return { ok: true, location: loc, source: "default_warehouse" };
  }

  if (defaultLocs.length > 1) {
    return {
      ok: false,
      code: "MULTIPLE_AMBIGUOUS_WAREHOUSES",
      status: 422,
      message: "Multiple default active warehouses are configured. Please specify an explicit stock_location_id.",
    };
  }

  // 4. Safe failure: No active warehouse found
  return {
    ok: false,
    code: "NO_ACTIVE_WAREHOUSE",
    status: 422,
    message: "No active warehouse pickup location is configured for dispatch.",
  };
}

/**
 * Registers or updates a warehouse pickup location in the database.
 */
export async function upsertWarehousePickupLocation(
  pg: Knex,
  input: {
    stockLocationId: string;
    pickupLocationCode: string;
    pickupLocationNickname: string;
    companyName: string;
    contactPerson: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
    isActive?: boolean;
  },
): Promise<WarehousePickupRecord> {
  const existing = (await pg("warehouse_pickup_location")
    .where({ pickup_location_code: input.pickupLocationCode })
    .first()) as WarehousePickupRecord | undefined;

  // If setting default, unset existing defaults
  if (input.isDefault) {
    await pg("warehouse_pickup_location").update({ is_default: false });
  }

  if (existing) {
    const [updated] = await pg("warehouse_pickup_location")
      .where({ id: existing.id })
      .update({
        stock_location_id: input.stockLocationId,
        pickup_location_nickname: input.pickupLocationNickname,
        company_name: input.companyName,
        contact_person: input.contactPerson,
        email: input.email,
        phone: input.phone,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2 ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        is_default: input.isDefault ?? existing.is_default,
        is_active: input.isActive ?? existing.is_active,
        updated_at: new Date(),
      })
      .returning("*");

    return updated as WarehousePickupRecord;
  }

  const id = generateEntityId(undefined, "wploc");
  const [created] = await pg("warehouse_pickup_location")
    .insert({
      id,
      stock_location_id: input.stockLocationId,
      pickup_location_code: input.pickupLocationCode,
      pickup_location_nickname: input.pickupLocationNickname,
      company_name: input.companyName,
      contact_person: input.contactPerson,
      email: input.email,
      phone: input.phone,
      address_line1: input.addressLine1,
      address_line2: input.addressLine2 ?? null,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      is_default: input.isDefault ?? false,
      is_active: input.isActive ?? true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning("*");

  return created as WarehousePickupRecord;
}
