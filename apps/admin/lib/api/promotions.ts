import "server-only";
import { backendFetch } from "../backend";

export interface Promotion {
  id: string;
  code: string | null;
  status: string;
  is_automatic: boolean;
  type: string;
  application_method?: {
    type: string;
    value: number;
    currency_code?: string | null;
    max_quantity?: number | null;
  } | null;
  usage_limit?: number | null;
  created_at: string;
}

export interface PromotionListResult {
  promotions: Promotion[];
  count: number;
  offset: number;
  limit: number;
}

/** GET /admin/promotions — native Medusa resource, backs A-13. */
export async function fetchPromotions(params?: {
  limit?: number;
  offset?: number;
}): Promise<PromotionListResult> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 20));
  search.set("offset", String(params?.offset ?? 0));
  search.set("fields", "*application_method");
  return backendFetch<PromotionListResult>(`/admin/promotions?${search.toString()}`);
}

export async function fetchPromotion(id: string): Promise<Promotion> {
  const { promotion } = await backendFetch<{ promotion: Promotion }>(
    `/admin/promotions/${id}?fields=*application_method`,
  );
  return promotion;
}

export interface PromotionInput {
  code: string;
  is_automatic?: boolean;
  type: "standard" | "buyget";
  status?: "draft" | "active" | "inactive";
  application_method: {
    type: "fixed" | "percentage";
    target_type: "order" | "shipping" | "items";
    allocation?: "each" | "across";
    value: number;
    currency_code?: string;
    max_quantity?: number;
  };
  limit?: number | null;
  usage_limit?: number | null;
}

export async function createPromotion(input: PromotionInput): Promise<Promotion> {
  const { usage_limit, limit, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  const effectiveLimit = limit ?? usage_limit;
  if (effectiveLimit !== undefined && effectiveLimit !== null) {
    payload.limit = effectiveLimit;
  }
  const { promotion } = await backendFetch<{ promotion: Promotion }>("/admin/promotions", {
    method: "POST",
    body: payload,
  });
  return promotion;
}

export async function updatePromotion(
  id: string,
  input: Partial<PromotionInput>,
): Promise<Promotion> {
  const { usage_limit, limit, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  const effectiveLimit = limit ?? usage_limit;
  if (effectiveLimit !== undefined && effectiveLimit !== null) {
    payload.limit = effectiveLimit;
  }
  const { promotion } = await backendFetch<{ promotion: Promotion }>(`/admin/promotions/${id}`, {
    method: "POST",
    body: payload,
  });
  return promotion;
}

export async function deletePromotion(id: string): Promise<void> {
  await backendFetch(`/admin/promotions/${id}`, { method: "DELETE" });
}
