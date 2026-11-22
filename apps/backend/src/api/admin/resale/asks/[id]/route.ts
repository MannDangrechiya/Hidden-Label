import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../../lib/audit";

interface UpdateAskBody {
  status?: string;
  notes?: string;
}

const VALID_STATUSES = [
  "active",
  "intake_received",
  "authenticated",
  "rejected",
  "sold",
  "settled",
  "cancelled",
  "archived",
];

/**
 * POST /admin/resale/asks/:id — Update consignment ask status and intake disposition.
 */
export async function POST(
  req: MedusaRequest<UpdateAskBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const { id } = req.params;
  const { status, notes } = req.body ?? {};

  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      type: "invalid_data",
      message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const existing = await pg("resale_ask").where({ id }).first();
  if (!existing) {
    res.status(404).json({ type: "not_found", message: "Consignment ask not found." });
    return;
  }

  await pg("resale_ask")
    .where({ id })
    .update({
      status,
      updated_at: new Date(),
    });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "resale.ask_status_update",
    entityType: "resale_ask",
    entityId: id,
    summary: `Consignment ask ${id} status updated from '${existing.status}' to '${status}' by ${actor.email}`,
    changes: { previous_status: existing.status, new_status: status, notes },
    ...meta,
  });

  const updated = await pg("resale_ask as a")
    .join("product_variant as pv", "pv.id", "a.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .join("customer as c", "c.id", "a.seller_id")
    .where("a.id", id)
    .first(
      "a.*",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "c.email as seller_email",
    );

  res.json({ ask: updated });
}
