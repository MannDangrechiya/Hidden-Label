import "server-only";
import { backendFetch } from "../backend";

export interface Brand {
  id: string;
  handle: string;
  name: string;
  tagline: string | null;
  description: string | null;
  country: string | null;
  partnership_tier: string | null;
  hero_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  sort_order: number;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrandInput {
  handle?: string;
  name?: string;
  tagline?: string | null;
  description?: string | null;
  country?: string | null;
  partnership_tier?: string | null;
  hero_url?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

/** GET /admin/brands — backs A-04. */
export async function fetchBrands(): Promise<Brand[]> {
  const { brands } = await backendFetch<{ brands: Brand[] }>("/admin/brands");
  return brands;
}

export async function createBrand(input: BrandInput): Promise<Brand> {
  const { brand } = await backendFetch<{ brand: Brand }>("/admin/brands", {
    method: "POST",
    body: input,
  });
  return brand;
}

export async function updateBrand(id: string, input: BrandInput): Promise<Brand> {
  const { brand } = await backendFetch<{ brand: Brand }>(`/admin/brands/${id}`, {
    method: "PATCH",
    body: input,
  });
  return brand;
}

export async function deleteBrand(id: string): Promise<void> {
  await backendFetch(`/admin/brands/${id}`, { method: "DELETE" });
}
