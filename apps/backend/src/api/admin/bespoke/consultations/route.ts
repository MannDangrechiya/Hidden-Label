import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../lib/admin-auth";

/**
 * GET /admin/bespoke/consultations — List in-person appointments and styling bookings (Phase 7).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const bookings = await pg("consultation_booking")
    .orderBy("scheduled_at", "asc")
    .select(
      "id",
      "customer_id",
      "customer_name",
      "customer_email",
      "customer_phone",
      "scheduled_at",
      "service_type",
      "status",
      "notes",
      "created_at",
    );

  res.json({ bookings });
}
