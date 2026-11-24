import "server-only";
import { backendFetch } from "../backend";

export interface DashboardSummary {
  orders_by_status: { status: string; count: number }[];
  revenue_captured: number;
  revenue_refunded: number;
  low_stock_count: number;
  open_returns: number;
  pending_shipments: number;
  /** Rolling 24-hour window, labelled as such in the UI. */
  orders_last_24h: number;
  /** Payment amounts captured in the last 24 hours, in rupees. */
  revenue_captured_last_24h: number;
  /** Return requests still in `requested` status — awaiting staff review. */
  returns_awaiting_review: number;
  recent_orders: {
    id: string;
    display_id: string;
    email: string | null;
    status: string;
    created_at: string;
    currency_code: string;
  }[];
  actor: { id: string; role: string };
}

/** GET /admin/dashboard/summary — backs A-01. */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return backendFetch<DashboardSummary>("/admin/dashboard/summary");
}
