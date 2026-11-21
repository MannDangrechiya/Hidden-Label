import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import type { Knex } from "knex";
import { requireRole } from "../../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../../lib/audit";
import { getShiprocketClient, isShiprocketConfigured } from "../../../../../lib/shiprocket-provider";
import { resolveWarehousePickup } from "../../../../../lib/warehouse-pickup";
import {
  claimShipmentOperation,
  completeShipmentOperation,
  failShipmentOperation,
} from "../../../../../lib/shipment-operations";
import { applyShipmentUpdate } from "../../../../../lib/shipment-status";
import type { ShiprocketOrderItem } from "../../../../../modules/shiprocket/types";

interface CreateShipmentBody {
  stock_location_id?: string;
  courier_id?: number;
  length?: number;
  breadth?: number;
  height?: number;
  weight?: number;
  retry?: boolean;
}

export async function GET(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const orderId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const order = await pg("order").where({ id: orderId }).whereNull("deleted_at").first();
  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  const shipment = await pg("shipment")
    .where({ order_id: orderId })
    .whereNull("deleted_at")
    .first();

  let tracking = null;
  if (shipment?.awb) {
    try {
      const client = getShiprocketClient();
      tracking = await client.trackAwb(shipment.awb);
    } catch {
      // Non-fatal tracking lookup failure
    }
  }

  const events = shipment
    ? await pg("shipment_event")
        .where({ shipment_id: shipment.id })
        .orderBy("occurred_at", "desc")
    : [];

  res.status(200).json({
    shipment: shipment || null,
    tracking: tracking?.tracking_data || null,
    events,
  });
}

export async function POST(
  req: MedusaRequest<CreateShipmentBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const orderId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const order = await pg("order").where({ id: orderId }).whereNull("deleted_at").first();
  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  if (order.canceled_at) {
    res.status(422).json({ type: "invalid_state", message: "Cannot dispatch a canceled order." });
    return;
  }

  if (process.env.NODE_ENV === "production" && !isShiprocketConfigured()) {
    res.status(503).json({
      type: "SHIPROCKET_NOT_CONFIGURED",
      message: "Shiprocket credentials (SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD) are not configured.",
    });
    return;
  }

  // 1. Resolve Warehouse Pickup Location
  const warehouseResult = await resolveWarehousePickup(pg, {
    stockLocationId: req.body?.stock_location_id,
    orderId,
  });

  if (!warehouseResult.ok) {
    res.status(warehouseResult.status).json({
      type: warehouseResult.code,
      message: warehouseResult.message,
    });
    return;
  }

  const warehouse = warehouseResult.location;

  // 2. Resolve Shipping Address
  const address = await pg("order_address")
    .where({ id: order.shipping_address_id })
    .first();

  if (!address || !address.postal_code) {
    res.status(422).json({
      type: "invalid_data",
      message: "Order has no valid shipping address or postal code.",
    });
    return;
  }

  // 3. Check Courier Serviceability
  const client = getShiprocketClient();
  const weight = req.body?.weight ?? 1.0;

  try {
    const serviceability = await client.checkServiceability({
      pickup_postcode: warehouse.pincode,
      delivery_postcode: address.postal_code,
      weight,
      cod: 0,
    });

    const couriers = serviceability.data?.available_courier_companies || [];
    if (couriers.length === 0) {
      res.status(422).json({
        type: "pincode_unserviceable",
        message: `Delivery pin code ${address.postal_code} is not serviceable from warehouse ${warehouse.pincode}.`,
      });
      return;
    }
  } catch (err: unknown) {
    res.status(502).json({
      type: "serviceability_check_failed",
      message: `Shiprocket serviceability check failed: ${(err as Error).message}`,
    });
    return;
  }

  // 4. Atomic Shipment Operation Mutex Claim
  const claim = await claimShipmentOperation(pg, {
    orderId,
    action: "dispatch_shiprocket",
    allowRetry: req.body?.retry === true,
  });

  if (claim.state === "duplicate") {
    res.status(200).json({
      ok: true,
      duplicate: true,
      shipment: {
        id: claim.shipmentId,
        awb: claim.awb,
        courier: claim.courier,
      },
      message: "Shipment already dispatched.",
    });
    return;
  }

  if (claim.state === "in_progress") {
    res.status(409).json({
      type: "SHIPMENT_DISPATCH_IN_PROGRESS",
      message: "A shipment dispatch operation is currently in progress for this order.",
      retryAfterMs: 2000,
    });
    return;
  }

  if (claim.state === "failed") {
    res.status(400).json({
      type: "SHIPMENT_OPERATION_FAILED",
      message: `Previous shipment dispatch failed: ${claim.error}. Set retry: true to re-attempt.`,
    });
    return;
  }

  const operationId = claim.operationId;

  // 5. Gather Line Items & Create Order in Shiprocket
  const orderItems = await pg("order_item")
    .where({ order_id: orderId })
    .whereNull("deleted_at");

  const itemsPayload: ShiprocketOrderItem[] = orderItems.map((item: { title?: string; item_id: string; quantity: number; unit_price?: number }) => ({
    name: item.title || "Luxury Fashion Item",
    sku: item.item_id || "THL-SKU-01",
    units: Number(item.quantity) || 1,
    selling_price: Math.max(1, Number(item.unit_price || 1000) / 100),
  }));

  const orderDateStr = new Date(order.created_at).toISOString().slice(0, 16).replace("T", " ");

  try {
    const srOrder = await client.createOrder({
      order_id: `THL-${order.display_id}`,
      order_date: orderDateStr,
      pickup_location: warehouse.pickup_location_nickname,
      billing_customer_name: address.first_name || "Customer",
      billing_last_name: address.last_name || "",
      billing_address: address.address_1 || "",
      billing_address_2: address.address_2 || undefined,
      billing_city: address.city || "",
      billing_pincode: address.postal_code,
      billing_state: address.province || warehouse.state,
      billing_country: "India",
      billing_email: order.email || "customer@thehiddenlabel.com",
      billing_phone: address.phone || warehouse.phone,
      shipping_is_billing: true,
      order_items: itemsPayload,
      payment_method: "Prepaid",
      sub_total: Math.max(1, Number(order.total || 1000) / 100),
      length: req.body?.length ?? 30,
      breadth: req.body?.breadth ?? 20,
      height: req.body?.height ?? 10,
      weight,
    });

    // 6. Assign AWB
    const awbRes = await client.assignAwb({
      shipment_id: srOrder.shipment_id,
      courier_id: req.body?.courier_id,
    });

    const awbData = awbRes.response?.data;
    const awbCode = awbData?.awb_code || `SRMOCK${Date.now()}`;
    const courierName = awbData?.courier_name || "Shiprocket Express";

    // 7. Generate Label
    let labelUrl: string | null = null;
    try {
      const labelRes = await client.generateLabel([srOrder.shipment_id]);
      labelUrl = labelRes.label_url || null;
    } catch {
      // Non-fatal if label PDF generation takes a moment
    }

    // 8. Persist Shipment in DB
    const shipmentId = generateEntityId(undefined, "shp");
    const [shipmentRow] = await pg("shipment")
      .insert({
        id: shipmentId,
        order_id: orderId,
        fulfillment_id: null,
        provider: "shiprocket",
        provider_shipment_id: String(srOrder.shipment_id),
        awb: awbCode,
        courier: courierName,
        status: "pickup_scheduled",
        label_url: labelUrl,
        last_synced_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    await applyShipmentUpdate(pg as unknown as Knex.Transaction, shipmentRow, {
      status: "pickup_scheduled",
      awb: awbCode,
      courier: courierName,
      source: "admin",
      note: `Shiprocket shipment created (SR Shipment ID: ${srOrder.shipment_id})`,
    });

    // 9. Complete Operation Mutex
    await completeShipmentOperation(pg, operationId, {
      shipmentId,
      providerOrderId: srOrder.order_id,
      providerShipmentId: srOrder.shipment_id,
      awb: awbCode,
      courier: courierName,
    });

    // 10. Audit Event
    await writeAudit(pg, {
      actorType: "admin",
      actorId: actor.id,
      action: "shipment.dispatched",
      entityType: "shipment",
      entityId: shipmentId,
      summary: `Shipment ${shipmentId} dispatched for Order THL-${order.display_id} via ${courierName} (AWB: ${awbCode})`,
      changes: {
        awb: awbCode,
        courier: courierName,
        sr_shipment_id: srOrder.shipment_id,
        warehouse: warehouse.pickup_location_code,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    res.status(200).json({
      ok: true,
      shipment: {
        id: shipmentId,
        awb: awbCode,
        courier: courierName,
        label_url: labelUrl,
        status: "pickup_scheduled",
        is_mock: client.isMock,
      },
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Shiprocket API dispatch failed";
    await failShipmentOperation(pg, operationId, errorMsg);

    res.status(502).json({
      type: "shiprocket_dispatch_failed",
      message: errorMsg,
    });
  }
}
