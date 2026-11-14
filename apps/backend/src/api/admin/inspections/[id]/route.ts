import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole, canWrite } from "../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../lib/audit";

interface UpdateInspectionBody {
  status?: "pending" | "in_review" | "approved" | "rejected";
  condition_grade?: string;
  box_condition?: string;
  notes?: string;
}

/**
 * GET /admin/inspections/:id
 * PATCH /admin/inspections/:id — Update inspection grading verdict (approve/reject).
 */
export async function GET(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const inspection = await pg("condition_inspection as ci")
    .join("product_variant as pv", "pv.id", "ci.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .where("ci.id", req.params.id)
    .whereNull("ci.deleted_at")
    .select(
      "ci.*",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.thumbnail as product_thumbnail",
    )
    .first();

  if (!inspection) {
    res.status(404).json({ type: "not_found", message: "Inspection record not found." });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ inspection });
}

export async function PATCH(
  req: MedusaRequest<UpdateInspectionBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor || !canWrite(actor.role)) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const id = req.params.id;

  const inspection = await pg("condition_inspection").where({ id }).whereNull("deleted_at").first();
  if (!inspection) {
    res.status(404).json({ type: "not_found", message: "Inspection record not found." });
    return;
  }

  const { status, condition_grade, box_condition, notes } = req.body ?? {};

  const updates: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (status) {
    updates.status = status;
    if (status === "approved" && !inspection.inspected_at) {
      updates.inspected_at = new Date();
      updates.inspector_id = actor.id;
    }
  }
  if (condition_grade) updates.condition_grade = condition_grade;
  if (box_condition) updates.box_condition = box_condition;
  if (notes !== undefined) updates.notes = notes;

  await pg("condition_inspection").where({ id }).update(updates);

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: "update",
    entityType: "condition_inspection",
    entityId: id,
    summary: `Inspection ${id} updated to status '${status ?? inspection.status}' by ${actor.email}`,
    changes: updates,
    ...meta,
  });

  const updated = await pg("condition_inspection").where({ id }).first();
  res.json({ inspection: updated });
}
