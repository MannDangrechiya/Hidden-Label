import type { Knex } from "knex";
import { getShiprocketClient, isShiprocketConfigured } from "./shiprocket-provider";
import { resolveWarehousePickup } from "./warehouse-pickup";
import { restockReturn, mergeRestockLines, type RestockLine, type RestockOutcome } from "./return-restock";
import { resolveStockLocation } from "./stock-location";
import { writeAudit } from "./audit";

export interface BookReversePickupInput {
  returnRequestId: string;
  weightKg?: number;
  actorId?: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface BookReversePickupResult {
  ok: boolean;
  awb: string | null;
  courier: string | null;
  status: string;
  duplicate: boolean;
  message?: string;
}

/**
 * Books reverse pickup for an approved RMA with Shiprocket.
 * Idempotent: If an AWB is already assigned, returns existing details without double-booking.
 */
export async function bookRmaReversePickup(
  pg: Knex,
  input: BookReversePickupInput,
): Promise<BookReversePickupResult> {
  const rma = await pg("return_request")
    .where({ id: input.returnRequestId })
    .whereNull("deleted_at")
    .first();

  if (!rma) {
    throw new Error(`Return request ${input.returnRequestId} not found.`);
  }

  // Idempotency check: Already has an AWB
  if (rma.awb) {
    return {
      ok: true,
      awb: rma.awb,
      courier: rma.courier,
      status: rma.status,
      duplicate: true,
      message: "Reverse pickup already booked.",
    };
  }

  const order = await pg("order")
    .where({ id: rma.order_id })
    .first("display_id", "email", "shipping_address_id");

  if (!order || !order.shipping_address_id) {
    throw new Error(`Original order ${rma.order_id} has no valid shipping address.`);
  }

  const address = await pg("order_address")
    .where({ id: order.shipping_address_id })
    .first();

  if (!address || !address.postal_code) {
    throw new Error(`Customer shipping address missing postal code.`);
  }

  // Resolve destination warehouse
  const warehouseResult = await resolveWarehousePickup(pg, { orderId: rma.order_id });
  if (!warehouseResult.ok) {
    throw new Error(`Destination warehouse resolution failed: ${warehouseResult.message}`);
  }
  const warehouse = warehouseResult.location;

  // Gather RMA line items
  const rmaItems = await pg("return_request_item as rri")
    .join("order_line_item as oli", "oli.id", "rri.order_item_id")
    .where("rri.return_request_id", rma.id)
    .select("oli.product_title", "oli.variant_sku", "rri.quantity", "oli.unit_price");

  const items = rmaItems.map((item: { product_title?: string; variant_sku?: string; quantity: number; unit_price?: number }) => ({
    name: item.product_title || "Returned Luxury Item",
    sku: item.variant_sku || "THL-SKU-01",
    units: Number(item.quantity) || 1,
    selling_price: Math.max(1, Number(item.unit_price || 1000) / 100),
  }));

  const subTotal = items.reduce((sum, item) => sum + item.selling_price * item.units, 0);

  if (process.env.NODE_ENV === "production" && !isShiprocketConfigured()) {
    throw new Error(
      "Shiprocket is not configured for reverse pickup (SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD missing).",
    );
  }

  const client = getShiprocketClient();
  const returnRes = await client.createReturn({
    order_id: rma.display_id,
    order_date: new Date().toISOString().slice(0, 10),
    pickup_customer_name: address.first_name || "Customer",
    pickup_last_name: address.last_name || "",
    pickup_address: address.address_1 || "",
    pickup_address_2: address.address_2 || undefined,
    pickup_city: address.city || "",
    pickup_state: address.province || warehouse.state,
    pickup_country: "India",
    pickup_pincode: address.postal_code,
    pickup_email: order.email || "customer@thehiddenlabel.com",
    pickup_phone: address.phone || warehouse.phone,
    shipping_customer_name: warehouse.company_name,
    shipping_address: warehouse.address_line1,
    shipping_address_2: warehouse.address_line2 || undefined,
    shipping_city: warehouse.city,
    shipping_state: warehouse.state,
    shipping_country: "India",
    shipping_pincode: warehouse.pincode,
    shipping_phone: warehouse.phone,
    order_items: items,
    sub_total: subTotal,
    length: 30,
    breadth: 20,
    height: 12,
    weight: input.weightKg ?? 1.0,
  });

  const awb = returnRes.awb_code || `SRREV${Date.now()}`;
  const courier = returnRes.courier_name || "Shiprocket Reverse Express";

  await pg("return_request")
    .where({ id: rma.id })
    .update({
      awb,
      courier,
      status: "pickup_scheduled",
      updated_at: new Date(),
    });

  await writeAudit(pg, {
    actorType: input.actorId ? "admin" : "system",
    actorId: input.actorId || "returns_system",
    action: "return.reverse_pickup_booked",
    entityType: "return_request",
    entityId: rma.id,
    summary: `Reverse pickup booked for ${rma.display_id} via ${courier} (AWB: ${awb})`,
    changes: { awb, courier, sr_order_id: returnRes.order_id },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return {
    ok: true,
    awb,
    courier,
    status: "pickup_scheduled",
    duplicate: false,
  };
}

export interface ReceiveAndInspectInput {
  returnRequestId: string;
  condition: "resellable" | "damaged" | "disposed";
  conditionNote?: string | null;
  locationId?: string | null;
  actorId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ReceiveAndInspectResult {
  returnRequest: Record<string, unknown>;
  restock: RestockOutcome | null;
}

/**
 * Marks an RMA as received, records physical inspection outcome, and restocks inventory
 * under row-level transaction locks if condition is resellable.
 */
export async function receiveAndInspectReturn(
  pg: Knex,
  input: ReceiveAndInspectInput,
): Promise<ReceiveAndInspectResult> {
  const rma = await pg("return_request")
    .where({ id: input.returnRequestId })
    .whereNull("deleted_at")
    .first();

  if (!rma) {
    throw new Error(`Return request ${input.returnRequestId} not found.`);
  }

  let restockPlan: { locationId: string; lines: RestockLine[] } | null = null;

  if (input.condition === "resellable") {
    const rows = (await pg("return_request_item as rri")
      .join("order_line_item as oli", "oli.id", "rri.order_item_id")
      .where("rri.return_request_id", rma.id)
      .select("oli.variant_id", "rri.quantity")) as {
      variant_id: string | null;
      quantity: number | string;
    }[];

    const variantIds = [
      ...new Set(rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id))),
    ];

    const links = variantIds.length
      ? ((await pg("product_variant_inventory_item")
          .whereIn("variant_id", variantIds)
          .select("variant_id", "inventory_item_id")) as {
          variant_id: string;
          inventory_item_id: string;
        }[])
      : [];

    const inventoryByVariant = new Map(
      links.map((link) => [link.variant_id, link.inventory_item_id]),
    );

    const lines = mergeRestockLines(
      rows.map((row) => ({
        inventoryItemId: row.variant_id ? (inventoryByVariant.get(row.variant_id) ?? "") : "",
        quantity: Number(row.quantity) || 0,
      })),
    );

    if (lines.length > 0) {
      const decision = await resolveStockLocation(pg, {
        orderId: rma.order_id,
        requestedLocationId: input.locationId ?? null,
      });

      if (!decision.ok) {
        throw new Error(`Stock location resolution failed: ${decision.message}`);
      }

      restockPlan = { locationId: decision.locationId, lines };
    }
  }

  let restockOutcome: RestockOutcome | null = null;

  const updatedRma = await pg.transaction(async (trx) => {
    // Lock return row
    const locked = (await trx("return_request")
      .where({ id: rma.id })
      .forUpdate()
      .first()) as Record<string, unknown> | undefined;

    if (!locked) throw new Error("Failed to acquire row lock on return request.");

    const [row] = await trx("return_request")
      .where({ id: rma.id })
      .update({
        status: "received",
        condition: input.condition,
        condition_note: input.conditionNote ?? null,
        received_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: input.actorId,
      action: "return.received",
      entityType: "return_request",
      entityId: rma.id,
      summary: `${rma.display_id} received and graded as ${input.condition}`,
      changes: {
        condition: input.condition,
        note: input.conditionNote,
      },
      ip: input.ip,
      userAgent: input.userAgent,
    });

    // Atomic restock under lock
    if (restockPlan) {
      if (locked.restocked_at) {
        restockOutcome = {
          restocked: false,
          reason: "already_restocked",
          locationId: restockPlan.locationId,
          units: 0,
          skipped: [],
        };
      } else {
        restockOutcome = await restockReturn(trx, {
          returnRequestId: rma.id,
          displayId: rma.display_id,
          locationId: restockPlan.locationId,
          lines: restockPlan.lines,
          audit: { actorId: input.actorId, ip: input.ip, userAgent: input.userAgent },
        });

        if (restockOutcome.restocked) {
          row.restocked_at = new Date();
        }
      }
    }

    return row;
  });

  return {
    returnRequest: updatedRma,
    restock: restockOutcome,
  };
}
