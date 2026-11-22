import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { requireRole } from "../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../lib/audit";

interface CreateFabricBody {
  name?: string;
  code?: string;
  mill?: string;
  composition?: string;
  weight_gsm?: number;
  color?: string;
  image_url?: string;
  surcharge_tier?: "standard" | "premium" | "ultra_luxury";
  surcharge_rupees?: number;
}

/**
 * GET & POST /admin/bespoke/fabrics — Atelier textile swatch manager (Phase 7).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const fabrics = await pg("fabric_swatch").orderBy("created_at", "desc");

  res.json({ fabrics });
}

export async function POST(req: MedusaRequest<CreateFabricBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const body = req.body ?? {};
  const name = body.name?.trim();
  const code = body.code?.trim();
  const mill = body.mill?.trim();
  const composition = body.composition?.trim();

  if (!name || !code || !mill || !composition) {
    res.status(400).json({
      type: "invalid_data",
      message: "Fabric name, unique code, mill origin, and composition are required.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const existing = await pg("fabric_swatch").where({ code }).first("id");
  if (existing) {
    res.status(409).json({ type: "duplicate_code", message: "A fabric with this code already exists." });
    return;
  }

  const fabricId = `fab_${randomBytes(8).toString("hex")}`;
  const now = new Date();

  const [fabric] = await pg("fabric_swatch")
    .insert({
      id: fabricId,
      name,
      code,
      mill,
      composition,
      weight_gsm: Number(body.weight_gsm) || 280,
      color: body.color?.trim() || "Midnight Blue",
      image_url: body.image_url?.trim() || null,
      surcharge_tier: body.surcharge_tier ?? "standard",
      surcharge_rupees: Number(body.surcharge_rupees) || 0,
      is_available: true,
      created_at: now,
      updated_at: now,
    })
    .returning("*");

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "bespoke.fabric_create",
    entityType: "fabric_swatch",
    entityId: fabricId,
    summary: `Fabric swatch ${code} (${name}) created by ${actor.email ?? actor.id}`,
    changes: { name, code, mill, surcharge_rupees: body.surcharge_rupees },
    ...meta,
  });

  res.status(201).json({ fabric });
}
