import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { customerStatus, isStale } from "../../../../../lib/shipment-status";
import { THL_MODULE } from "../../../../../modules/thl";
import { actorId } from "../../../../../lib/auth";
import type ThlModuleService from "../../../../../modules/thl/service";

/** GET /store/orders/:id/shipment — owner-only tracking timeline. */
export async function GET(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to track this order." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);

  const order = await pg("order")
    .where({ id: req.params.id, customer_id: customerId })
    .whereNull("deleted_at")
    .first("id", "display_id");

  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  const shipments = await thl.listShipments({ order_id: order.id }, { order: { created_at: "DESC" } });
  const latest = shipments[0];

  if (!latest) {
    res.json({ shipment: null, events: [] });
    return;
  }

  const events = await thl.listShipmentEvents(
    { shipment_id: latest.id },
    { order: { occurred_at: "ASC" } },
  );

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    shipment: {
      id: latest.id,
      awb: latest.awb,
      courier: latest.courier,
      status: latest.status,
      status_label: customerStatus(latest.status),
      stale: isStale(latest.last_synced_at as unknown as string | null),
      label_url: latest.label_url,
      shipped_at: latest.shipped_at,
      delivered_at: latest.delivered_at,
    },
    events: events.map((event) => ({
      status: event.status,
      label: customerStatus(event.status),
      occurred_at: event.occurred_at,
    })),
  });
}
