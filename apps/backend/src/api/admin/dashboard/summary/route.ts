import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { requireRole } from "../../../../lib/admin-auth";

/** GET /admin/dashboard/summary — KPI cards and the queues that need a human. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actor = await requireRole(req, res, "support");
  if (!actor) return;

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const ordersByStatus = await pg("order")
    .whereNull("deleted_at")
    .groupBy("status")
    .select("status")
    .count<{ status: string; count: string }[]>("id as count");

  const captured = await pg("payment")
    .whereNotNull("captured_at")
    .sum<{ total: string }[]>("amount as total");

  const refunded = await pg("refund").sum<{ total: string }[]>("amount as total");

  const lowStock = await pg("inventory_level")
    .whereRaw("(stocked_quantity - reserved_quantity) <= 3")
    .count<{ count: string }[]>("id as count");

  const openReturns = await pg("return_request")
    .whereIn("status", ["requested", "approved", "in_transit", "received", "inspecting"])
    .count<{ count: string }[]>("id as count");

  const pendingShipments = await pg("shipment")
    .whereIn("status", ["created", "pickup_scheduled"])
    .count<{ count: string }[]>("id as count");

  const recentOrders = await pg("order")
    .whereNull("deleted_at")
    .orderBy("created_at", "desc")
    .limit(8)
    .select("id", "display_id", "email", "status", "created_at", "currency_code");

  res.setHeader("Cache-Control", "no-store");
  res.json({
    orders_by_status: ordersByStatus.map((row) => ({
      status: row.status,
      count: Number(row.count),
    })),
    revenue_captured: Number(captured[0]?.total ?? 0),
    revenue_refunded: Number(refunded[0]?.total ?? 0),
    low_stock_count: Number(lowStock[0]?.count ?? 0),
    open_returns: Number(openReturns[0]?.count ?? 0),
    pending_shipments: Number(pendingShipments[0]?.count ?? 0),
    recent_orders: recentOrders,
    actor: { id: actor.id, role: actor.role },
  });
}
