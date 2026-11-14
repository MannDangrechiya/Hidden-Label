import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../lib/admin-auth";

interface Query {
  [key: string]: unknown;
  entity_type?: string;
  entity_id?: string;
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
}

/**
 * GET /admin/audit — an ordinary activity log with filters. Presented as an activity stream,
 * never as a tamper-proof ledger (decision D2).
 */
export async function GET(req: MedusaRequest<unknown, Query>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  const offset = Math.max(Number(req.query.offset ?? 0) || 0, 0);

  const base = pg("audit_event");
  const entityType = String(req.query.entity_type ?? "");
  const entityId = String(req.query.entity_id ?? "");
  const actorIdFilter = String(req.query.actor ?? "");
  const action = String(req.query.action ?? "");
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (entityType) base.where("entity_type", entityType);
  if (entityId) base.where("entity_id", entityId);
  if (actorIdFilter) base.where("actor_id", actorIdFilter);
  if (action) base.where("action", "like", `${action}%`);
  if (from) base.where("occurred_at", ">=", from);
  if (to) base.where("occurred_at", "<=", to);

  const countRow = await base.clone().count<{ count: string }[]>("id as count");
  const events = await base
    .clone()
    .orderBy("occurred_at", "desc")
    .limit(limit)
    .offset(offset)
    .select("*");

  res.setHeader("Cache-Control", "no-store");
  res.json({
    events,
    count: Number(countRow[0]?.count ?? 0),
    offset,
    limit,
    note: "Activity log — entries are append-only; this is not a cryptographic ledger.",
  });
}
