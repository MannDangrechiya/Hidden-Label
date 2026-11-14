import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../lib/audit";
import { requireRole } from "../../../lib/admin-auth";
import { customerStatus, isStale } from "../../../lib/shipment-status";
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

  const providerConfigured = Boolean(
    process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD,
  );

  const shipment = await pg.transaction(async (trx) => {
    const [row] = await trx("shipment")
      .insert({
        order_id: orderId,
        provider: providerConfigured ? "shiprocket" : "manual",
        courier: req.body?.courier ?? null,
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
      changes: { provider: row.provider, courier: row.courier },
      ...meta,
    });

    return row;
  });

  res.status(201).json({ shipment });
}
