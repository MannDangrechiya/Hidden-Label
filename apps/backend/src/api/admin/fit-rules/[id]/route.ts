import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole, canWrite } from "../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../lib/audit";

interface UpdateFitRuleBody {
  brand_id?: string;
  silhouette_name?: string;
  fit_tendency?: string;
  recommended_size_delta?: number;
  width_profile?: string;
  guidance_text?: string;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const { id } = req.params;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const rule = await pg("silhouette_fit_rule as fr")
    .leftJoin("brand as b", "b.id", "fr.brand_id")
    .where("fr.id", id)
    .whereNull("fr.deleted_at")
    .select("fr.*", "b.name as brand_name")
    .first();

  if (!rule) {
    res.status(404).json({ message: `Fit rule with id '${id}' not found.` });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ rule });
}

export async function PUT(req: MedusaRequest<UpdateFitRuleBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const { id } = req.params;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const existing = await pg("silhouette_fit_rule")
    .where({ id })
    .whereNull("deleted_at")
    .first();

  if (!existing) {
    res.status(404).json({ message: `Fit rule with id '${id}' not found.` });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (req.body.silhouette_name !== undefined) updates.silhouette_name = req.body.silhouette_name;
  if (req.body.guidance_text !== undefined) updates.guidance_text = req.body.guidance_text;
  if (req.body.fit_tendency !== undefined) updates.fit_tendency = req.body.fit_tendency;
  if (req.body.recommended_size_delta !== undefined) updates.recommended_size_delta = req.body.recommended_size_delta;
  if (req.body.width_profile !== undefined) updates.width_profile = req.body.width_profile;
  if (req.body.brand_id !== undefined) updates.brand_id = req.body.brand_id;
  updates.updated_at = new Date();

  await pg("silhouette_fit_rule").where({ id }).update(updates);

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "update",
    entityType: "silhouette_fit_rule",
    entityId: id,
    summary: `Fit rule updated for '${updates.silhouette_name ?? existing.silhouette_name}'`,
    changes: updates,
    ...meta,
  });

  const updated = await pg("silhouette_fit_rule").where({ id }).first();
  res.json({ rule: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const { id } = req.params;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const existing = await pg("silhouette_fit_rule")
    .where({ id })
    .whereNull("deleted_at")
    .first();

  if (!existing) {
    res.status(404).json({ message: `Fit rule with id '${id}' not found.` });
    return;
  }

  await pg("silhouette_fit_rule").where({ id }).update({
    deleted_at: new Date(),
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "delete",
    entityType: "silhouette_fit_rule",
    entityId: id,
    summary: `Fit rule deleted: ${existing.silhouette_name}`,
    changes: { silhouette_name: existing.silhouette_name },
    ...meta,
  });

  res.status(200).json({ id, object: "silhouette_fit_rule", deleted: true });
}
