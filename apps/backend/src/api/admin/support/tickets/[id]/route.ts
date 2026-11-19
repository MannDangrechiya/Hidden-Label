import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../../../lib/audit";
import { requireRole } from "../../../../../lib/admin-auth";

interface Body {
  status?: string;
  priority?: string;
  assigned_to?: string;
  resolution?: string;
}

const STATUSES = ["open", "in_progress", "awaiting_customer", "resolved", "closed"];

/** POST /admin/support/tickets/:id — move a ticket through its lifecycle. */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const ticketId = (req.params as Record<string, string | undefined>)?.id;
  if (!ticketId) {
    res.status(400).json({ type: "invalid_data", message: "A ticket id is required." });
    return;
  }

  const body = req.body ?? {};
  const patch: Record<string, unknown> = { updated_at: new Date() };

  if (body.status) {
    if (!STATUSES.includes(body.status)) {
      res.status(400).json({ type: "invalid_data", message: "Unknown ticket status." });
      return;
    }
    patch.status = body.status;
    if (body.status === "resolved") {
      patch.resolved_at = new Date();
    }
  }
  if (body.priority) patch.priority = body.priority;
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to || null;
  if (body.resolution !== undefined) patch.resolution = body.resolution || null;

  if (Object.keys(patch).length === 1) {
    res.status(400).json({ type: "invalid_data", message: "Nothing to update." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const updated = await pg.transaction(async (trx) => {
    const existing = await trx("support_ticket")
      .where({ id: ticketId })
      .whereNull("deleted_at")
      .first("id", "display_id", "status");
    if (!existing) return null;

    const [row] = await trx("support_ticket")
      .where({ id: ticketId })
      .update(patch)
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "support_ticket.updated",
      entityType: "support_ticket",
      entityId: ticketId,
      summary: `${existing.display_id} updated by ${actor.email ?? actor.id}`,
      changes: { from: existing.status, to: row.status, ...patch },
      ...meta,
    });

    return row;
  });

  if (!updated) {
    res.status(404).json({ type: "not_found", message: "Ticket not found." });
    return;
  }

  res.json({ ticket: updated });
}
