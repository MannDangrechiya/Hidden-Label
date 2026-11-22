import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../../lib/admin-auth";
import { requestMeta, writeAudit } from "../../../../../lib/audit";

interface ActionBody {
  action?: "approve" | "reject";
}

/**
 * POST /admin/reviews/:id/action — Moderate a review (approve or reject) with audit tracking (Phase 5).
 */
export async function POST(
  req: MedusaRequest<ActionBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const reviewId = req.params.id;
  const action = req.body?.action;

  if (!action || !["approve", "reject"].includes(action)) {
    res.status(400).json({
      type: "invalid_data",
      message: "Action must be either 'approve' or 'reject'.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const review = await pg("product_review").where({ id: reviewId }).first();

  if (!review) {
    res.status(404).json({ type: "not_found", message: "Review not found." });
    return;
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const now = new Date();

  await pg("product_review")
    .where({ id: reviewId })
    .update({
      status: newStatus,
      moderated_by: actor.id,
      moderated_at: now,
      updated_at: now,
    });

  const meta = requestMeta(req);
  await writeAudit(pg, {
    actorType: "admin",
    actorId: actor.id,
    action: `review.${action}`,
    entityType: "product_review",
    entityId: reviewId,
    summary: `Review ${reviewId} ${action}d by ${actor.email ?? actor.id}`,
    changes: {
      from: review.status,
      to: newStatus,
    },
    ...meta,
  });

  const updated = await pg("product_review").where({ id: reviewId }).first();
  res.json({ review: updated, message: `Review ${action}d successfully.` });
}
