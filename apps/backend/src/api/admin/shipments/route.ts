import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../lib/audit";
import { requireRole } from "../../../lib/admin-auth";
import { computePackage } from "../../../lib/package";
import { customerStatus, isStale } from "../../../lib/shipment-status";
import { createShiprocketOrder, isConfigured as shiprocketConfigured } from "../../../lib/shiprocket";
import { THL_MODULE } from "../../../modules/thl";
import type ThlModuleService from "../../../modules/thl/service";

interface Body {
  order_id?: string;
  courier?: string;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const rows = await pg("shipment as s")
    .join("order as o", "o.id", "s.order_id")
    .whereNull("s.deleted_at")
    .orderBy("s.created_at", "desc")
    .limit(100)
    .select("s.*", "o.display_id as order_display_id");

  res.setHeader("Cache-Control", "no-store");
  res.json({
    shipments: rows.map((row: Record<string, unknown>) => ({
      ...row,
      status_label: customerStatus(String(row.status)),
      stale: isStale(row.last_synced_at as string | null),
    })),
  });
}

/**
 * POST /admin/shipments — create the local shipment record.
 *
 * With Shiprocket credentials configured the provider is called first; without them the
 * shipment is recorded as a manual dispatch, which is exactly what it is. Nothing pretends an
 * AWB exists when none was issued.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const orderId = req.body?.order_id;
  if (!orderId) {
    res.status(400).json({ type: "invalid_data", message: "order_id is required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const meta = requestMeta(req);

  const order = await pg("order").where({ id: orderId }).whereNull("deleted_at").first();
  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  const existing = await thl.listShipments({ order_id: orderId });
  if (existing[0]) {
    res.status(409).json({
      type: "conflict",
      message: "A shipment already exists for this order.",
      shipment: existing[0],
    });
    return;
  }

  // D2/P6: only label a shipment "shiprocket" when Shiprocket's API actually returned a real
  // shipment — never on credential-presence alone (that was the previous bug: a shipment could
  // be recorded as `provider: "shiprocket"` with no AWB because the API was never called).
  let providerResult: {
    provider: "shiprocket" | "manual";
    providerShipmentId: string | null;
    awb: string | null;
    courier: string | null;
    labelUrl: string | null;
    note: string | null;
  } = {
    provider: "manual",
    providerShipmentId: null,
    awb: null,
    courier: req.body?.courier ?? null,
    labelUrl: null,
    note: null,
  };

  if (shiprocketConfigured()) {
    try {
      const address = (await pg("order_address")
        .where({ id: order.shipping_address_id })
        .first()) as Record<string, unknown> | undefined;
      const lineItems = (await pg("order_line_item as oli")
        .join("order_item as oi", "oi.item_id", "oli.id")
        .where("oi.order_id", order.id)
        .whereNull("oli.deleted_at")
        .select(
          "oli.product_id",
          "oli.product_title",
          "oli.variant_sku",
          "oli.metadata",
          "oi.quantity",
          "oli.unit_price",
        )) as Record<string, unknown>[];

      if (!address) throw new Error("Order has no shipping address on file.");
      if (lineItems.length === 0) throw new Error("Order has no line items.");

      // GAP-LOG-02: real dimensions/weight from product metadata + category, never the
      // universal 30×20×12 / 0.6 kg box.
      const productIds = [
        ...new Set(lineItems.map((item) => String(item.product_id ?? "")).filter(Boolean)),
      ];
      const productRows = productIds.length
        ? ((await pg("product").whereIn("id", productIds).select("id", "metadata")) as Record<
            string,
            unknown
          >[])
        : [];
      const metaByProduct = new Map(
        productRows.map((row) => [String(row.id), (row.metadata ?? {}) as Record<string, unknown>]),
      );

      const pkg = computePackage(
        lineItems.map((item) => {
          const productMeta = metaByProduct.get(String(item.product_id ?? "")) ?? {};
          const lineMeta = (item.metadata ?? {}) as Record<string, unknown>;
          return {
            quantity: Number(item.quantity ?? 1),
            category: typeof productMeta.category === "string" ? productMeta.category : null,
            metadata: { ...productMeta, ...lineMeta },
          };
        }),
      );

      // GAP-LOG-02: a COD order must reach the courier as COD, a prepaid one as Prepaid.
      const orderMeta = (order.metadata ?? {}) as Record<string, unknown>;
      const paymentMethod = orderMeta.payment_method === "cod" ? "COD" : "Prepaid";

      const result = await createShiprocketOrder({
        orderId: order.id,
        orderDisplayId: String(order.display_id),
        orderDate: new Date(order.created_at as string).toISOString().slice(0, 10),
        customerName: `${address.first_name ?? ""} ${address.last_name ?? ""}`.trim() || "Customer",
        addressLine1: String(address.address_1 ?? ""),
        addressLine2: address.address_2 ? String(address.address_2) : undefined,
        city: String(address.city ?? ""),
        state: String(address.province ?? ""),
        pincode: String(address.postal_code ?? ""),
        phone: String(address.phone ?? ""),
        email: String(order.email ?? ""),
        items: lineItems.map((item) => ({
          name: String(item.product_title ?? "Item"),
          sku: String(item.variant_sku ?? item.product_title ?? "SKU"),
          units: Number(item.quantity ?? 1),
          selling_price: Number(item.unit_price ?? 0),
        })),
        subTotalRupees: lineItems.reduce(
          (sum, item) => sum + Number(item.unit_price ?? 0) * Number(item.quantity ?? 1),
          0,
        ),
        paymentMethod,
        weightKg: pkg.chargeableWeightKg,
        lengthCm: pkg.lengthCm,
        breadthCm: pkg.breadthCm,
        heightCm: pkg.heightCm,
      });

      providerResult = {
        provider: "shiprocket",
        providerShipmentId: result.shipmentId,
        awb: result.awb,
        courier: result.courierName ?? providerResult.courier,
        labelUrl: result.labelUrl,
        note: null,
      };
    } catch (error) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
      logger.warn(
        `Shiprocket order creation failed for order ${order.display_id}, falling back to manual: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      providerResult.note =
        "Shiprocket API call failed — recorded as a manual dispatch. See server logs for the cause.";
    }
  }

  const shipment = await pg.transaction(async (trx) => {
    const [row] = await trx("shipment")
      .insert({
        id: generateEntityId(undefined, "shp"),
        order_id: orderId,
        provider: providerResult.provider,
        provider_shipment_id: providerResult.providerShipmentId,
        awb: providerResult.awb,
        courier: providerResult.courier,
        label_url: providerResult.labelUrl,
        status: "created",
        last_synced_at: new Date(),
      })
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "shipment.created",
      entityType: "shipment",
      entityId: row.id,
      summary: `Shipment created for order ${order.display_id}`,
      changes: { provider: row.provider, courier: row.courier, awb: row.awb },
      ...meta,
    });

    return row;
  });

  res.status(201).json({ shipment, note: providerResult.note });
}
