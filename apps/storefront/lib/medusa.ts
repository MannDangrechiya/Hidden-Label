/**
 * Server-side Medusa store API client.
 *
 * No mock or sample-data fallback anywhere: if the backend is unreachable the caller renders an
 * error state (docs/QA_PLAN.md §5.5 copy honesty).
 */

const MEDUSA_URL = process.env.MEDUSA_URL ?? "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? "";
const CURRENCY_CODE = "inr";

export const SALES_CHANNEL_ERROR =
  "The catalogue is not published to the storefront sales channel.";

function headers(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = { accept: "application/json" };
  if (PUBLISHABLE_KEY) base["x-publishable-api-key"] = PUBLISHABLE_KEY;
  return { ...base, ...extra };
}

export class MedusaError extends Error {
  override name = "MedusaError";
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; revalidate?: number; tags?: string[] },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${MEDUSA_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: headers(init?.body ? { "content-type": "application/json" } : undefined),
      body: init?.body ? JSON.stringify(init.body) : undefined,
      // Catalogue data is cached only for the duration of a request: these pages are dynamic and
      // a stale product/variant id after an admin edit produces confusing cart errors.
      ...(init?.method && init.method !== "GET"
        ? { cache: "no-store" as const }
        : { next: { revalidate: init?.revalidate ?? 0 } }),
    });
  } catch (error) {
    throw new MedusaError(
      `Cannot reach the Medusa backend at ${MEDUSA_URL}. Is it running? (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new MedusaError(
      `Medusa returned ${response.status} for ${path}: ${body.slice(0, 300)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface StoreVariant {
  id: string;
  title: string | null;
  sku: string | null;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  inventory_quantity?: number;
  calculated_price?: {
    calculated_amount: number | null;
    currency_code: string | null;
  } | null;
}

export interface StoreProduct {
  id: string;
  title: string;
  handle: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
  options?: { id: string; title: string; values?: string[] }[] | null;
  variants?: StoreVariant[] | null;
  collection?: { id: string; title: string; handle: string } | null;
}

interface ProductsResponse {
  products: StoreProduct[];
  count: number;
  offset: number;
  limit: number;
}

interface StoreRegion {
  id: string;
  currency_code: string;
}

export interface StoreLineItem {
  id: string;
  title: string;
  product_title: string | null;
  variant_title: string | null;
  quantity: number;
  thumbnail: string | null;
  unit_price: number;
  total: number;
  variant_id: string | null;
  product_handle?: string;
}

export interface StoreCart {
  id: string;
  items: StoreLineItem[];
  item_total?: number;
  subtotal?: number;
  shipping_total?: number;
  total?: number;
  currency_code: string;
}

/* -------------------------------------------------------------------------- */
/*  Pricing context                                                           */
/* -------------------------------------------------------------------------- */

let cachedRegionId: string | null = null;

/**
 * Medusa 2.22 requires a pricing context (a region) to calculate prices; `currency_code` is not
 * an accepted query field. Regions are stable, so the INR region id is resolved once.
 */
export async function resolveRegionId(): Promise<string | null> {
  if (cachedRegionId) return cachedRegionId;
  try {
    const body = await request<{ regions?: StoreRegion[] }>("/store/regions", {
      revalidate: 300,
    });
    // Regions change rarely; the 5-minute cache above is the only intentional one.
    const regions = body.regions ?? [];
    const region = regions.find((item) => item.currency_code === CURRENCY_CODE) ?? regions[0];
    cachedRegionId = region?.id ?? null;
    return cachedRegionId;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Catalog                                                                   */
/* -------------------------------------------------------------------------- */

const PRODUCT_FIELDS = "*variants.calculated_price,*variants,*options,*collection";

export async function fetchProducts(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  order?: string;
}): Promise<ProductsResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 24));
  search.set("offset", String(params?.offset ?? 0));
  search.set("fields", PRODUCT_FIELDS);
  if (params?.q) search.set("q", params.q);
  if (params?.order) search.set("order", params.order);

  const regionId = await resolveRegionId();
  if (regionId) search.set("region_id", regionId);

  return request<ProductsResponse>(`/store/products?${search.toString()}`);
}

export async function fetchProduct(handle: string): Promise<StoreProduct | null> {
  const search = new URLSearchParams();
  search.set("handle", handle);
  search.set("limit", "1");
  search.set("fields", PRODUCT_FIELDS);

  const regionId = await resolveRegionId();
  if (regionId) search.set("region_id", regionId);

  const body = await request<ProductsResponse>(`/store/products?${search.toString()}`);
  return body.products[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Cart                                                                      */
/* -------------------------------------------------------------------------- */

export async function createCart(): Promise<StoreCart> {
  const regionId = await resolveRegionId();
  const body = await request<{ cart: StoreCart }>("/store/carts", {
    method: "POST",
    body: regionId ? { region_id: regionId } : {},
  });
  return body.cart;
}

export async function fetchCart(cartId: string): Promise<StoreCart | null> {
  try {
    const body = await request<{ cart: StoreCart }>(`/store/carts/${cartId}`, {
      revalidate: 0,
    });
    return body.cart;
  } catch (error) {
    if (error instanceof MedusaError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

export async function addLineItem(
  cartId: string,
  variantId: string,
  quantity = 1,
): Promise<StoreCart> {
  const body = await request<{ cart: StoreCart }>(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: { variant_id: variantId, quantity },
  });
  return body.cart;
}

export async function updateLineItem(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<StoreCart> {
  const body = await request<{ cart: StoreCart }>(
    `/store/carts/${cartId}/line-items/${lineId}`,
    { method: "POST", body: { quantity } },
  );
  return body.cart;
}

export async function removeLineItem(cartId: string, lineId: string): Promise<void> {
  await request<unknown>(`/store/carts/${cartId}/line-items/${lineId}`, { method: "DELETE" });
}

export function backendUrl(): string {
  return MEDUSA_URL;
}

/**
 * Whether the variant can be added to the bag.
 *
 * Medusa's **store** API deliberately does not expose inventory counts (they are admin data), so
 * `inventory_quantity` is usually undefined here. Guessing "sold out" from a missing field would
 * hide purchasable products, so unknown stock counts as selectable and the cart is the authority:
 * if stock really is gone, Medusa rejects the line item and the UI shows that message verbatim.
 * When a count is present (admin/seed contexts) it is used.
 */
export function isVariantAvailable(variant: StoreVariant): boolean {
  if (variant.allow_backorder) return true;
  if (variant.manage_inventory === false) return true;
  if (variant.inventory_quantity === undefined || variant.inventory_quantity === null) return true;
  return variant.inventory_quantity > 0;
}

/** Stock count when the API exposes one, otherwise null (unknown, not zero). */
export function knownStock(variant: StoreVariant): number | null {
  return typeof variant.inventory_quantity === "number" ? variant.inventory_quantity : null;
}
