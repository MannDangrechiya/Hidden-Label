import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../lib/audit";
import { canWrite, requireRole } from "../../../lib/admin-auth";

interface Body {
  handle?: string;
  name?: string;
  tagline?: string;
  description?: string;
  country?: string;
  partnership_tier?: string;
  hero_url?: string;
  logo_url?: string;
  is_active?: boolean;
  sort_order?: number;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const brands = await pg("brand as b")
    .leftJoin("product_brand as pb", "pb.brand_id", "b.id")
    .whereNull("b.deleted_at")
    .groupBy("b.id")
    .orderBy("b.sort_order", "asc")
    .select("b.*", pg.raw("count(pb.product_id)::int as product_count"));

  res.setHeader("Cache-Control", "no-store");
  res.json({ brands });
}

/** POST /admin/brands — creates the brand and its audit event in one transaction. */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const body = req.body ?? {};
  const handle = body.handle?.trim().toLowerCase();

  if (!handle || !/^[a-z0-9-]+$/.test(handle) || !body.name?.trim()) {
    res.status(400).json({
      type: "invalid_data",
      message: "A lowercase handle and a name are required.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  try {
    const brand = await pg.transaction(async (trx) => {
      const [row] = await trx("brand")
        .insert({
          id: generateEntityId(undefined, "brand"),
          handle,
          name: body.name?.trim(),
          tagline: body.tagline ?? null,
          description: body.description ?? null,
          country: body.country ?? null,
          partnership_tier: body.partnership_tier ?? null,
          hero_url: body.hero_url ?? null,
          logo_url: body.logo_url ?? null,
          is_active: body.is_active ?? true,
          sort_order: body.sort_order ?? 0,
          metadata: JSON.stringify({ created_by: actor.id }),
        })
        .returning("*");

      await writeAudit(trx, {
        actorType: "admin",
        actorId: actor.id,
        action: "brand.created",
        entityType: "brand",
        entityId: row.id,
        summary: `Brand ${row.name} created`,
        changes: { handle: row.handle },
        ...meta,
      });

      return row;
    });

    res.status(201).json({ brand });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the brand.";
    const conflict = message.includes("brand_handle_unique") || message.includes("duplicate key");
    res.status(conflict ? 409 : 500).json({
      type: conflict ? "conflict" : "error",
      message: conflict ? "That handle is already in use." : message,
    });
  }
}
