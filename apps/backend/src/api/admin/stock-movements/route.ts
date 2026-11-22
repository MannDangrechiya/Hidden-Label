import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../lib/admin-auth";

/**
 * GET /admin/stock-movements — Centralized stock movement audit ledger (Phase 6, P6-04).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "operations");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const movements = await pg("stock_movement")
    .orderBy("created_at", "desc")
    .limit(100)
    .select(
      "id",
      "inventory_item_id",
      "location_id",
      "delta",
      "movement_type",
      "reference_id",
      "actor_id",
      "notes",
      "balance_after",
      "created_at",
    );

  res.json({ stock_movements: movements });
}
