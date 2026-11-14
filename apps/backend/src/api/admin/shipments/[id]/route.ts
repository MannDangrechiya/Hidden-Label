import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../../lib/audit";
import { requireRole } from "../../../../lib/admin-auth";
import { applyShipmentUpdate, customerStatus, isStale } from "../../../../lib/shipment-status";
import { THL_MODULE } from "../../../../modules/thl";
import type ThlModuleService from "../../../../modules/thl/service";

interface Body {
  status?: string;
  awb?: string;
  courier?: string;
  event_key?: string;
  note?: string;
}

/** GET /admin/shipments/:id — detail + event timeline. */
export async function GET(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const shipment = await thl.retrieveShipment(req.params.id).catch(() => null);
  if (!shipment) {
    res.status(404).json({ type: "not_found", message: "Shipment not found." });
    return;
  }

  const events = await thl.listShipmentEvents(
    { shipment_id: shipment.id },
    { order: { occurred_at: "ASC" } },
  );

  res.setHeader("Cache-Control", "no-store");
  res.json({
    shipment: {
      ...shipment,
      status_label: customerStatus(shipment.status),
      stale: isStale(shipment.last_synced_at as unknown as string | null),
    },
    events,
  });
}

/**
 * POST /admin/shipments/:id — record an AWB and/or a tracking event for an operator's manual
 * dispatch. A real Shiprocket webhook cannot call this route (it requires an admin session) —
 * see `/webhooks/shiprocket`, which shares the same `applyShipmentUpdate` logic so the two paths
 * can never disagree and both are idempotent on (shipment_id, event_key).
 */
export async function POST(
  req: MedusaRequest<Body> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const shipment = await thl.retrieveShipment(req.params.id).catch(() => null);
  if (!shipment) {
    res.status(404).json({ type: "not_found", message: "Shipment not found." });
    return;
  }

  const updated = await pg.transaction(async (trx) => {
    const { shipment: row, status } = await applyShipmentUpdate(trx, shipment, {
      status: req.body?.status,
      awb: req.body?.awb,
      courier: req.body?.courier,
      eventKey: req.body?.event_key,
      source: "admin",
      note: req.body?.note,
    });

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "shipment.updated",
      entityType: "shipment",
      entityId: shipment.id,
      summary: `Shipment for order marked ${customerStatus(status)}`,
      changes: { from: shipment.status, to: status, awb: row.awb },
      ...meta,
    });

    return row;
  });

  res.json({ shipment: updated, status_label: customerStatus(updated.status) });
}
