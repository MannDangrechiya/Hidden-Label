import "server-only";
import { backendFetch } from "../backend";

export interface CustomerListItem {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  has_account: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface CustomerListResult {
  customers: CustomerListItem[];
  count: number;
  offset: number;
  limit: number;
}

export async function fetchCustomers(params?: {
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<CustomerListResult> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 20));
  search.set("offset", String(params?.offset ?? 0));
  search.set("order", "-created_at");
  if (params?.q) search.set("q", params.q);
  return backendFetch<CustomerListResult>(`/admin/customers?${search.toString()}`);
}

export interface CustomerDetail extends CustomerListItem {
  addresses?: {
    id: string;
    address_1: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
  }[];
  orders?: { id: string; display_id: number; status: string; total: number; created_at: string }[];
}

export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const { customer } = await backendFetch<{ customer: CustomerDetail }>(
    `/admin/customers/${id}?fields=*addresses,*orders`,
  );
  return customer;
}

/**
 * Tier and notes are stored on `metadata` — Medusa's native customer record has no bespoke
 * tier/notes column, and the project has not added a custom module for it (A-09 only asks for
 * "notes, tier" on PATCH :id, so metadata is the documented, non-invented place for it).
 */
export async function updateCustomerNotes(
  id: string,
  input: { tier?: string | null; notes?: string | null },
): Promise<CustomerDetail> {
  const { customer } = await backendFetch<{ customer: CustomerDetail }>(`/admin/customers/${id}`, {
    method: "POST",
    body: { metadata: input },
  });
  return customer;
}
