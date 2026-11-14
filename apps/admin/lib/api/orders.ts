import "server-only";
import { backendFetch } from "../backend";

export interface OrderListItem {
  id: string;
  display_id: number;
  email: string | null;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  currency_code: string;
  total: number;
  created_at: string;
}

export interface OrderListResult {
  orders: OrderListItem[];
  count: number;
  offset: number;
  limit: number;
}

const LIST_FIELDS =
  "id,display_id,email,status,fulfillment_status,payment_status,currency_code,total,created_at";

export async function fetchOrders(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: string;
}): Promise<OrderListResult> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 20));
  search.set("offset", String(params?.offset ?? 0));
  search.set("fields", LIST_FIELDS);
  search.set("order", "-created_at");
  if (params?.q) search.set("q", params.q);
  if (params?.status) search.set("status", params.status);
  return backendFetch<OrderListResult>(`/admin/orders?${search.toString()}`);
}

export interface OrderItemLine {
  id: string;
  title: string;
  product_title: string | null;
  variant_title: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  fulfilled_quantity: number | null;
}

export interface OrderPayment {
  id: string;
  amount: number;
  currency_code: string;
  captured_at: string | null;
  canceled_at: string | null;
  provider_id: string;
  refunds?: { id: string; amount: number; created_at: string; note?: string | null }[];
}

export interface OrderDetail {
  id: string;
  display_id: number;
  email: string | null;
  status: string;
  fulfillment_status: string;
  payment_status: string;
  currency_code: string;
  total: number;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  created_at: string;
  items: OrderItemLine[];
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    address_1?: string | null;
    address_2?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
    phone?: string | null;
  } | null;
  customer?: { id: string; email: string | null; first_name?: string | null; last_name?: string | null } | null;
  payment_collections?: { id: string; status: string; payments?: OrderPayment[] }[];
}

const DETAIL_FIELDS =
  "*items,*shipping_address,*customer,*payment_collections,*payment_collections.payments,*payment_collections.payments.refunds";

export async function fetchOrder(id: string): Promise<OrderDetail> {
  const { order } = await backendFetch<{ order: OrderDetail }>(
    `/admin/orders/${id}?fields=${encodeURIComponent(DETAIL_FIELDS)}`,
  );
  return order;
}

export type OrderAction = "capture" | "fulfill" | "cancel" | "refund";

/** POST /admin/orders/:id/actions — the project's own action bar wrapper (A-08). */
export async function runOrderAction(
  id: string,
  action: OrderAction,
  input?: { reason?: string; amount?: number },
): Promise<{ order: { id: string; display_id: string; status: string }; action: OrderAction }> {
  return backendFetch(`/admin/orders/${id}/actions`, {
    method: "POST",
    body: { action, ...input },
  });
}
