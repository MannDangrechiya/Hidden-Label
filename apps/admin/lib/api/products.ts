import "server-only";
import { backendFetch } from "../backend";

export type ProductStatus = "draft" | "proposed" | "published" | "rejected";

export interface AdminVariantPrice {
  id?: string;
  currency_code: string;
  amount: number;
}

export interface AdminVariant {
  id: string;
  title: string;
  sku: string | null;
  manage_inventory: boolean;
  allow_backorder: boolean;
  options?: Record<string, string>;
  prices?: AdminVariantPrice[];
  inventory_quantity?: number;
}

export interface AdminProduct {
  id: string;
  title: string;
  handle: string;
  subtitle: string | null;
  description: string | null;
  status: ProductStatus;
  thumbnail: string | null;
  images?: { id: string; url: string }[];
  options?: { id: string; title: string; values?: { value: string }[] }[];
  variants?: AdminVariant[];
  categories?: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
}

export interface ProductListResult {
  products: AdminProduct[];
  count: number;
  offset: number;
  limit: number;
}

const LIST_FIELDS =
  "id,title,handle,status,thumbnail,created_at,updated_at,*categories,*variants,*variants.inventory_quantity";
const DETAIL_FIELDS =
  "*variants,*variants.prices,*variants.options,*options,*options.values,*categories,*images";

export async function fetchProducts(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: ProductStatus[];
}): Promise<ProductListResult> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 20));
  search.set("offset", String(params?.offset ?? 0));
  search.set("fields", LIST_FIELDS);
  if (params?.q) search.set("q", params.q);
  if (params?.status) for (const s of params.status) search.append("status[]", s);
  return backendFetch<ProductListResult>(`/admin/products?${search.toString()}`);
}

export async function fetchProduct(id: string): Promise<AdminProduct> {
  const { product } = await backendFetch<{ product: AdminProduct }>(
    `/admin/products/${id}?fields=${encodeURIComponent(DETAIL_FIELDS)}`,
  );
  return product;
}

export interface ProductInput {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  handle?: string;
  status?: ProductStatus;
  thumbnail?: string | null;
  images?: { url: string }[];
  categories?: { id: string }[];
  sales_channels?: { id: string }[];
  options?: { title: string; values: string[] }[];
  variants?: {
    title: string;
    sku?: string | null;
    manage_inventory?: boolean;
    options?: Record<string, string>;
    prices: { currency_code: string; amount: number }[];
  }[];
}

export async function createProduct(input: ProductInput): Promise<AdminProduct> {
  const { product } = await backendFetch<{ product: AdminProduct }>("/admin/products", {
    method: "POST",
    body: input,
  });
  return product;
}

export interface ProductUpdateInput {
  title?: string;
  subtitle?: string | null;
  description?: string | null;
  status?: ProductStatus;
  thumbnail?: string | null;
  images?: { url: string }[];
  categories?: { id: string }[];
}

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<AdminProduct> {
  const { product } = await backendFetch<{ product: AdminProduct }>(`/admin/products/${id}`, {
    method: "POST",
    body: input,
  });
  return product;
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<AdminProduct> {
  return updateProduct(id, { status });
}

export async function upsertVariants(
  productId: string,
  payload: {
    create?: {
      title: string;
      sku?: string | null;
      options?: Record<string, string>;
      prices: { currency_code: string; amount: number }[];
    }[];
    update?: {
      id: string;
      title?: string;
      sku?: string | null;
      prices?: { id?: string; currency_code: string; amount: number }[];
    }[];
    delete?: string[];
  },
): Promise<AdminProduct> {
  const { product } = await backendFetch<{ product: AdminProduct }>(
    `/admin/products/${productId}/variants/batch`,
    { method: "POST", body: payload },
  );
  return product;
}

export interface SalesChannel {
  id: string;
  name: string;
}

/** Used to attach a newly created product to the storefront's sales channel. */
export async function fetchDefaultSalesChannel(): Promise<SalesChannel | null> {
  const { sales_channels } = await backendFetch<{ sales_channels: SalesChannel[] }>(
    "/admin/sales-channels?limit=1",
  );
  return sales_channels[0] ?? null;
}
