import "server-only";
import { backendFetch } from "../backend";

export interface AdminInspection {
  id: string;
  variant_id: string;
  unit_serial: string;
  inspector_id: string | null;
  status: "pending" | "in_review" | "approved" | "rejected";
  condition_grade: string;
  box_condition: string;
  turntable_media: unknown;
  detail_photos: unknown;
  checklist: unknown;
  notes: string | null;
  inspected_at: string | null;
  created_at: string;
  variant_title: string;
  variant_sku: string | null;
  product_id: string;
  product_title: string;
  product_handle: string;
  product_thumbnail: string | null;
}

export interface AdminResaleAsk {
  id: string;
  variant_id: string;
  seller_id: string;
  ask_price: string | number;
  condition_grade: string;
  box_condition: string;
  status: string;
  created_at: string;
  variant_title: string;
  variant_sku: string | null;
  product_id: string;
  product_title: string;
  product_handle: string;
  seller_email: string;
}

export interface AdminResaleBid {
  id: string;
  variant_id: string;
  buyer_id: string;
  bid_price: string | number;
  status: string;
  expires_at: string;
  created_at: string;
  variant_title: string;
  variant_sku: string | null;
  product_id: string;
  product_title: string;
  product_handle: string;
  buyer_email: string;
}

export interface AdminFitRule {
  id: string;
  brand_id: string | null;
  silhouette_name: string;
  fit_tendency: string;
  recommended_size_delta: number | string;
  width_profile: string;
  guidance_text: string;
  brand_name?: string | null;
}

export async function fetchAdminInspections(): Promise<AdminInspection[]> {
  const { inspections } = await backendFetch<{ inspections: AdminInspection[] }>(
    "/admin/inspections",
  );
  return inspections;
}

export async function updateAdminInspection(
  id: string,
  body: { status?: string; notes?: string; condition_grade?: string },
): Promise<AdminInspection> {
  const { inspection } = await backendFetch<{ inspection: AdminInspection }>(
    `/admin/inspections/${id}`,
    {
      method: "PATCH",
      body,
    },
  );
  return inspection;
}

export async function fetchAdminResaleAsks(): Promise<AdminResaleAsk[]> {
  const { asks } = await backendFetch<{ asks: AdminResaleAsk[] }>("/admin/resale/asks");
  return asks;
}

export async function updateAdminResaleAsk(
  id: string,
  body: { status: string; notes?: string },
): Promise<AdminResaleAsk> {
  const { ask } = await backendFetch<{ ask: AdminResaleAsk }>(`/admin/resale/asks/${id}`, {
    method: "POST",
    body,
  });
  return ask;
}

export async function fetchAdminResaleBids(): Promise<AdminResaleBid[]> {
  const { bids } = await backendFetch<{ bids: AdminResaleBid[] }>("/admin/resale/bids");
  return bids;
}

export async function fetchAdminFitRules(): Promise<AdminFitRule[]> {
  const { rules } = await backendFetch<{ rules: AdminFitRule[] }>("/admin/fit-rules");
  return rules;
}

export async function createAdminFitRule(body: {
  silhouette_name: string;
  guidance_text: string;
  fit_tendency?: string;
  recommended_size_delta?: number;
  width_profile?: string;
}): Promise<AdminFitRule> {
  const { rule } = await backendFetch<{ rule: AdminFitRule }>("/admin/fit-rules", {
    method: "POST",
    body,
  });
  return rule;
}

export async function deleteAdminFitRule(id: string): Promise<void> {
  await backendFetch(`/admin/fit-rules/${id}`, {
    method: "DELETE",
  });
}

