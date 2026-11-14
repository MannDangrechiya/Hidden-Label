import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../lib/audit";
import { canWrite, requireRole } from "../../../lib/admin-auth";

interface Body {
  slug?: string;
  kind?: string;
  title?: string;
  body_md?: string;
  is_published?: boolean;
  seo_title?: string;
  seo_description?: string;
}

const KINDS = ["page", "policy", "faq", "banner", "drop"];

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const pages = await pg("cms_page")
    .whereNull("deleted_at")
    .orderBy("updated_at", "desc")
    .select("id", "slug", "kind", "title", "is_published", "published_at", "updated_at");

  res.setHeader("Cache-Control", "no-store");
  res.json({ pages });
}

export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const body = req.body ?? {};
  const slug = body.slug?.trim().replace(/^\/+/, "");

  if (!slug || !body.title?.trim() || !body.kind || !KINDS.includes(body.kind)) {
    res.status(400).json({
      type: "invalid_data",
      message: "A slug, title and valid kind are required.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  try {
    const page = await pg.transaction(async (trx) => {
      const [row] = await trx("cms_page")
        .insert({
          slug,
          kind: body.kind,
          title: body.title?.trim(),
          body_md: body.body_md ?? null,
          is_published: body.is_published ?? false,
          published_at: body.is_published ? new Date() : null,
          seo_title: body.seo_title ?? null,
          seo_description: body.seo_description ?? null,
          blocks: JSON.stringify([]),
        })
        .returning("*");

      await writeAudit(trx, {
        actorType: "admin",
        actorId: actor.id,
        action: body.is_published ? "cms.published" : "cms.created",
        entityType: "cms_page",
        entityId: row.id,
        summary: `Page ${row.slug} ${body.is_published ? "published" : "created"}`,
        changes: { slug: row.slug, kind: row.kind },
        ...meta,
      });

      return row;
    });

    res.status(201).json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the page.";
    const conflict = message.includes("cms_page_slug_unique") || message.includes("duplicate key");
    res.status(conflict ? 409 : 500).json({
      type: conflict ? "conflict" : "error",
      message: conflict ? "That slug is already in use." : message,
    });
  }
}
