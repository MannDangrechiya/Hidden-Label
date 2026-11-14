import "server-only";
import { backendFetch } from "../backend";

export interface PaymentListItem {
  id: string;
  amount: number;
  currency_code: string;
  provider_id: string;
  captured_at: string | null;
  canceled_at: string | null;
  created_at: string;
  payment_collection?: { id: string; order?: { id: string; display_id: number } | null } | null;
}

export interface PaymentListResult {
  payments: PaymentListItem[];
  count: number;
  offset: number;
  limit: number;
}

/**
 * GET /admin/payments — native Medusa resource. A-10 surfaces payments & refunds read from
 * orders (see lib/api/orders.ts for the order-scoped refund action); this list is the
 * cross-order console view.
 */
export async function fetchPayments(params?: { limit?: number; offset?: number }): Promise<PaymentListResult> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 20));
  search.set("offset", String(params?.offset ?? 0));
  search.set("order", "-created_at");
  search.set(
    "fields",
    "id,amount,currency_code,provider_id,captured_at,canceled_at,created_at,*payment_collection,*payment_collection.order",
  );
  return backendFetch<PaymentListResult>(`/admin/payments?${search.toString()}`);
}
