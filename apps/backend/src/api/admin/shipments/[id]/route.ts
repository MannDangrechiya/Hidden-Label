import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../../lib/audit";
import { requireRole } from "../../../../lib/admin-auth";
import { customerStatus, isStale, mapProviderStatus } from "../../../../lib/shipment-status";
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
 * POST /admin/shipments/:id — record an AWB and/or a tracking event.
 * Used both by the Shiprocket webhook path and by an operator entering a manual dispatch.
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

  const status = req.body?.status ? mapProviderStatus(req.body.status) : shipment.status;
  const eventKey =
    req.body?.event_key ?? `${status}-${new Date().toISOString().slice(0, 19)}`;

  const updated = await pg.transaction(async (trx) => {
    const [row] = await trx("shipment")
      .where({ id: shipment.id })
      .update({
        status,
        awb: req.body?.awb ?? shipment.awb,
        courier: req.body?.courier ?? shipment.courier,
        last_synced_at: new Date(),
        shipped_at:
          status === "picked_up" || status === "in_transit"
            ? (shipment.shipped_at ?? new Date())
            : shipment.shipped_at,
        delivered_at: status === "delivered" ? new Date() : shipment.delivered_at,
        updated_at: new Date(),
      })
      .returning("*");

    await trx("shipment_event")
      .insert({
        shipment_id: shipment.id,
        event_key: eventKey,
        status,
        occurred_at: new Date(),
        payload: JSON.stringify({ source: "admin", note: req.body?.note ?? null }),
      })
      .onConflict(["shipment_id", "event_key"])
      .ignore();

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
