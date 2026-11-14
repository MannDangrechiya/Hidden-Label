import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requestMeta, writeAudit } from "../../../../lib/audit";
import { canWrite, requireRole } from "../../../../lib/admin-auth";

interface Body {
  name?: string;
  tagline?: string | null;
  description?: string | null;
  country?: string | null;
  partnership_tier?: string | null;
  hero_url?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export async function PATCH(
  req: MedusaRequest<Body> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const allowed: (keyof Body)[] = [
    "name",
    "tagline",
    "description",
    "country",
    "partnership_tier",
    "hero_url",
    "logo_url",
    "is_active",
    "sort_order",
  ];

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ type: "invalid_data", message: "No supported fields were supplied." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const before = await pg("brand").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!before) {
    res.status(404).json({ type: "not_found", message: "Brand not found." });
    return;
  }

  const brand = await pg.transaction(async (trx) => {
    const [row] = await trx("brand")
      .where({ id: req.params.id })
      .update({ ...patch, updated_at: new Date() })
      .returning("*");

    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "brand.updated",
      entityType: "brand",
      entityId: row.id,
      summary: `Brand ${row.name} updated`,
      changes: { before, after: patch },
      ...meta,
    });

    return row;
  });

  res.json({ brand });
}

/** DELETE archives the brand. A brand with products is deactivated instead of deleted. */
export async function DELETE(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "manager");
  if (!actor || !canWrite(actor.role)) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const meta = requestMeta(req);

  const brand = await pg("brand").where({ id: req.params.id }).whereNull("deleted_at").first();
  if (!brand) {
    res.status(404).json({ type: "not_found", message: "Brand not found." });
    return;
  }

  const linked = await pg("product_brand").where({ brand_id: brand.id }).count<{ count: string }[]>("product_id as count");
  if (Number(linked[0]?.count ?? 0) > 0) {
    await pg.transaction(async (trx) => {
      await trx("brand").where({ id: brand.id }).update({ is_active: false, updated_at: new Date() });
      await writeAudit(trx, {
        actorType: "admin",
        actorId: actor.id,
        action: "brand.archived",
        entityType: "brand",
        entityId: brand.id,
        summary: `Brand ${brand.name} deactivated (products are still linked)`,
        changes: { is_active: false },
        ...meta,
      });
    });

    res.status(409).json({
      type: "conflict",
      message: "This brand still has products, so it was deactivated instead of deleted.",
      brand: { ...brand, is_active: false },
    });
    return;
  }

  await pg.transaction(async (trx) => {
    await trx("brand").where({ id: brand.id }).update({ deleted_at: new Date(), is_active: false });
    await writeAudit(trx, {
      actorType: "admin",
      actorId: actor.id,
      action: "brand.deleted",
      entityType: "brand",
      entityId: brand.id,
      summary: `Brand ${brand.name} archived`,
      changes: {},
      ...meta,
    });
  });

  res.json({ deleted: true });
}
