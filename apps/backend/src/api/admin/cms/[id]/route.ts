import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../../lib/audit";
import { canWrite, requireRole } from "../../../../lib/admin-auth";

interface Body {
  title?: string;
  body_md?: string;
  is_published?: boolean;
  seo_title?: string | null;
  seo_description?: string | null;
}

export async function GET(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const page = await pg("cms_page").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!page) {
    res.status(404).json({ type: "not_found", message: "Page not found." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json({ page });
}

export async function PATCH(
  req: MedusaRequest<Body> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const body = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.body_md !== undefined) patch.body_md = body.body_md;
  if (body.seo_title !== undefined) patch.seo_title = body.seo_title;
  if (body.seo_description !== undefined) patch.seo_description = body.seo_description;
  if (body.is_published !== undefined) {
    patch.is_published = body.is_published;
    patch.published_at = body.is_published ? new Date() : null;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ type: "invalid_data", message: "No supported fields were supplied." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const before = await pg("cms_page").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!before) {
    res.status(404).json({ type: "not_found", message: "Page not found." });
    return;
  }

  const page = await pg.transaction(async (trx) => {
    const [row] = await trx("cms_page")
      .where({ id: req.params.id })
      .update({ ...patch, updated_at: new Date() })
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "cms.updated",
      entityType: "cms_page",
      entityId: row.id,
      summary: `Page ${row.slug} updated`,
      changes: { before: before.is_published, after: row.is_published },
      ...meta,
    });

    return row;
  });

  res.json({ page });
}
