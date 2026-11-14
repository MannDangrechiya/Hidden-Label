import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { requireRole, canWrite } from "../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../lib/audit";

interface CreateFitRuleBody {
  brand_id?: string;
  silhouette_name?: string;
  fit_tendency?: string;
  recommended_size_delta?: number;
  width_profile?: string;
  guidance_text?: string;
}

/**
 * GET /admin/fit-rules — List all silhouette fit rules.
 * POST /admin/fit-rules — Create or update a silhouette fit rule.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const rules = await pg("silhouette_fit_rule as fr")
    .leftJoin("brand as b", "b.id", "fr.brand_id")
    .whereNull("fr.deleted_at")
    .orderBy("fr.silhouette_name", "asc")
    .select("fr.*", "b.name as brand_name");

  res.setHeader("Cache-Control", "no-store");
  res.json({ rules });
}

export async function POST(req: MedusaRequest<CreateFitRuleBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const {
    brand_id,
    silhouette_name,
    fit_tendency = "true_to_size",
    recommended_size_delta = 0,
    width_profile = "regular",
    guidance_text,
  } = req.body ?? {};

  if (!silhouette_name || !guidance_text) {
    res.status(400).json({
      type: "invalid_data",
      message: "silhouette_name and guidance_text are required.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const id = generateEntityId(undefined, "fit");

  await pg("silhouette_fit_rule").insert({
    id,
    brand_id: brand_id ?? null,
    silhouette_name,
    fit_tendency,
    recommended_size_delta,
    width_profile,
    guidance_text,
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "create",
    entityType: "silhouette_fit_rule",
    entityId: id,
    summary: `Fit rule created for '${silhouette_name}' (${fit_tendency}, delta ${recommended_size_delta})`,
    changes: { silhouette_name, fit_tendency, recommended_size_delta },
    ...meta,
  });

  const created = await pg("silhouette_fit_rule").where({ id }).first();
  res.status(201).json({ rule: created });
}
