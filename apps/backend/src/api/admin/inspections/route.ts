import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { requireRole, canWrite } from "../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../lib/audit";

interface CreateInspectionBody {
  variant_id?: string;
  unit_serial?: string;
  condition_grade?: string;
  box_condition?: string;
  turntable_media?: string[];
  detail_photos?: Array<{ label: string; url: string }>;
  checklist?: Record<string, unknown>;
  notes?: string;
  status?: "pending" | "approved" | "rejected";
}

/**
 * GET /admin/inspections — Inspection queue for physical warehouse & authentication units.
 * POST /admin/inspections — Record a new physical unit inspection.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const statusFilter = (req.query as Record<string, string | undefined>)?.status;

  const q = pg("condition_inspection as ci")
    .join("product_variant as pv", "pv.id", "ci.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .whereNull("ci.deleted_at")
    .orderBy("ci.created_at", "desc")
    .select(
      "ci.*",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.thumbnail as product_thumbnail",
    );

  if (statusFilter) {
    q.where("ci.status", statusFilter);
  }

  const inspections = await q;

  res.setHeader("Cache-Control", "no-store");
  res.json({ inspections });
}

export async function POST(req: MedusaRequest<CreateInspectionBody>, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor || !canWrite(actor.role)) return;

  const {
    variant_id,
    unit_serial,
    condition_grade = "Deadstock 10/10",
    box_condition = "perfect",
    turntable_media = [],
    detail_photos = [],
    checklist = {},
    notes,
    status = "pending",
  } = req.body ?? {};

  if (!variant_id) {
    res.status(400).json({ type: "invalid_data", message: "variant_id is required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Validate variant exists
  const variant = await pg("product_variant").where({ id: variant_id }).whereNull("deleted_at").first();
  if (!variant) {
    res.status(404).json({ type: "not_found", message: "Variant not found." });
    return;
  }

  const id = generateEntityId(undefined, "ins");
  const serial = unit_serial ?? `THL-${id.slice(-8).toUpperCase()}`;

  await pg("condition_inspection").insert({
    id,
    variant_id,
    unit_serial: serial,
    inspector_id: actor.id,
    status,
    condition_grade,
    box_condition,
    turntable_media: JSON.stringify(turntable_media),
    detail_photos: JSON.stringify(detail_photos),
    checklist: JSON.stringify(checklist),
    notes: notes ?? null,
    inspected_at: status === "approved" ? new Date() : null,
  });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "create",
    entityType: "condition_inspection",
    entityId: id,
    summary: `Inspection recorded for unit ${serial}: grade ${condition_grade}, status ${status}`,
    changes: { variant_id, unit_serial: serial, status, condition_grade },
    ...meta,
  });

  const created = await pg("condition_inspection").where({ id }).first();
  res.status(201).json({ inspection: created });
}
