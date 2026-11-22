import "server-only";
import { backendFetch } from "../backend";

export interface AdminSupplier {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  gstin: string | null;
  address: string | null;
  status: "active" | "inactive";
  created_at: string;
}

export interface AdminPurchaseOrder {
  id: string;
  display_id: string;
  supplier_id: string;
  supplier_name: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  total_cost_rupees: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminStockMovement {
  id: string;
  inventory_item_id: string;
  location_id: string;
  delta: number;
  movement_type: "po_receipt" | "manual_adjustment" | "order_fulfillment" | "return_restock" | "damage_shrinkage";
  reference_id: string | null;
  actor_id: string | null;
  notes: string | null;
  balance_after: number;
  created_at: string;
}

export async function fetchAdminSuppliers(): Promise<AdminSupplier[]> {
  const data = await backendFetch<{ suppliers: AdminSupplier[] }>("/admin/suppliers");
  return data.suppliers ?? [];
}

export async function fetchAdminPurchaseOrders(): Promise<AdminPurchaseOrder[]> {
  const data = await backendFetch<{ purchase_orders: AdminPurchaseOrder[] }>("/admin/purchase-orders");
  return data.purchase_orders ?? [];
}

export async function fetchAdminStockMovements(): Promise<AdminStockMovement[]> {
  const data = await backendFetch<{ stock_movements: AdminStockMovement[] }>("/admin/stock-movements");
  return data.stock_movements ?? [];
}
