import "server-only";
import { backendFetch } from "../backend";

export interface ProductCategory {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  is_active: boolean;
  is_internal: boolean;
  rank: number;
  parent_category_id: string | null;
  category_children?: { id: string; name: string }[];
}

/** GET /admin/product-categories — native Medusa resource, backs A-05. */
export async function fetchCategories(): Promise<ProductCategory[]> {
  const { product_categories } = await backendFetch<{ product_categories: ProductCategory[] }>(
    "/admin/product-categories?limit=200&fields=id,name,handle,description,is_active,is_internal,rank,parent_category_id,*category_children",
  );
  return product_categories;
}

export interface CategoryInput {
  name?: string;
  handle?: string;
  description?: string | null;
  is_active?: boolean;
  is_internal?: boolean;
  parent_category_id?: string | null;
}

export async function createCategory(input: CategoryInput): Promise<ProductCategory> {
  const { product_category } = await backendFetch<{ product_category: ProductCategory }>(
    "/admin/product-categories",
    { method: "POST", body: input },
  );
  return product_category;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ProductCategory> {
  const { product_category } = await backendFetch<{ product_category: ProductCategory }>(
    `/admin/product-categories/${id}`,
    { method: "POST", body: input },
  );
  return product_category;
}

export async function deleteCategory(id: string): Promise<void> {
  await backendFetch(`/admin/product-categories/${id}`, { method: "DELETE" });
}
