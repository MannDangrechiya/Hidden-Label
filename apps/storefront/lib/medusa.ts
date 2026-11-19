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
    const text = await response.text();
    // Medusa's error shape is `{ type, message, code? }` (docs/API_PLAN.md §1) — surface the
    // human sentence directly when present instead of the raw status + body.
    let message = `Medusa returned ${response.status} for ${path}: ${text.slice(0, 300)}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Not JSON — keep the raw fallback above.
    }
    throw new MedusaError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Same as `request`, but attaches a customer bearer token (never sent from the browser). */
async function authRequest<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${MEDUSA_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: headers({
        authorization: `Bearer ${token}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
      }),
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (error) {
    throw new MedusaError(
      `Cannot reach the Medusa backend at ${MEDUSA_URL}. Is it running? (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }

  if (!response.ok) {
    const text = await response.text();
    let message = `Medusa returned ${response.status} for ${path}: ${text.slice(0, 300)}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // Not JSON — keep the raw fallback above.
    }
    throw new MedusaError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
  /** Custom made-to-measure data lives here as `custom_measurements` (see addToCart). */
  metadata?: Record<string, unknown> | null;
}

export interface StoreCart {
  id: string;
  items: StoreLineItem[];
  item_total?: number;
  subtotal?: number;
  discount_total?: number;
  shipping_total?: number;
  total?: number;
  currency_code: string;
  email?: string | null;
  promotions?: {
    id: string;
    code: string;
    is_automatic?: boolean;
    application_method?: {
      type: string;
      value: number;
    } | null;
  }[];
  shipping_address?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    address_1: string | null;
    address_2: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    country_code: string | null;
  } | null;
  shipping_methods?: { id: string; name: string; shipping_option_id: string }[];
  /** Set at checkout: fulfilment mode (`home_delivery` / `store_pickup`) and consent. */
  metadata?: Record<string, unknown> | null;
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
  metadata?: Record<string, unknown>,
): Promise<StoreCart> {
  const body = await request<{ cart: StoreCart }>(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: { variant_id: variantId, quantity, ...(metadata ? { metadata } : {}) },
  });
  return body.cart;
}

/**
 * Merges `metadata` into the cart. Used for checkout facts that are not product data:
 * the fulfilment mode chosen (home delivery vs Sindhu Bhavan pickup), the prepaid payment
 * method and the DPDP consent timestamp. Medusa's update replaces `metadata` wholesale, so
 * the merge happens here.
 */
export async function setCartMetadata(
  cartId: string,
  metadata: Record<string, unknown>,
  token?: string,
): Promise<StoreCart> {
  const existing = await fetchCart(cartId);
  const merged = { ...(existing?.metadata ?? {}), ...metadata };
  const body = token
    ? await authRequest<{ cart: StoreCart }>(`/store/carts/${cartId}`, token, {
        method: "POST",
        body: { metadata: merged },
      })
    : await request<{ cart: StoreCart }>(`/store/carts/${cartId}`, {
        method: "POST",
        body: { metadata: merged },
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

export async function addCartPromotion(cartId: string, promoCode: string): Promise<StoreCart> {
  const body = await request<{ cart: StoreCart }>(`/store/carts/${cartId}/promotions`, {
    method: "POST",
    body: { promo_codes: [promoCode] },
  });
  return body.cart;
}

export async function removeCartPromotion(cartId: string, promoCode: string): Promise<StoreCart> {
  const body = await request<{ cart: StoreCart }>(`/store/carts/${cartId}/promotions`, {
    method: "DELETE",
    body: { promo_codes: [promoCode] },
  });
  return body.cart;
}

/**
 * Attaches the signed-in customer to a cart (`transferCartCustomerWorkflow`). Without this call
 * a cart created while logged in stays a guest cart forever — Medusa's generic
 * `POST /store/carts/:id` does not read `auth_context` — and the resulting order would never
 * show up in `GET /store/orders` (which filters by `customer_id`). Safe to call repeatedly.
 */
export async function attachCustomerToCart(cartId: string, token: string): Promise<void> {
  await authRequest(`/store/carts/${cartId}/customer`, token, { method: "POST" });
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

/* -------------------------------------------------------------------------- */
/*  Real-time stock (custom /store/catalog/stock route)                      */
/* -------------------------------------------------------------------------- */

export async function fetchStock(
  variantIds: string[],
): Promise<Record<string, { available: number }>> {
  if (variantIds.length === 0) return {};
  const body = await request<{ stock: Record<string, { available: number }> }>(
    "/store/catalog/stock",
    { method: "POST", body: { variant_ids: variantIds } },
  );
  return body.stock;
}

/* -------------------------------------------------------------------------- */
/*  Brands (custom /store/brands routes)                                     */
/* -------------------------------------------------------------------------- */

export interface StoreBrand {
  id: string;
  handle: string;
  name: string;
  tagline: string | null;
  description?: string | null;
  logo_url: string | null;
  hero_url: string | null;
  country: string | null;
  partnership_tier: string | null;
  sort_order?: number;
  product_count?: number;
}

export async function fetchBrands(): Promise<{ brands: StoreBrand[]; count: number }> {
  return request<{ brands: StoreBrand[]; count: number }>("/store/brands");
}

export async function fetchBrand(
  handle: string,
  params?: { limit?: number; offset?: number },
): Promise<{ brand: StoreBrand; product_ids: string[]; count: number; offset: number; limit: number } | null> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  try {
    return await request(`/store/brands/${handle}?${search.toString()}`);
  } catch (error) {
    if (error instanceof MedusaError && error.status === 404) return null;
    throw error;
  }
}

/** Fetch a specific, stable-ordered set of products by id, keeping the region pricing context. */
export async function fetchProductsByIds(ids: string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) return [];
  const search = new URLSearchParams();
  search.set("limit", String(ids.length));
  search.set("fields", PRODUCT_FIELDS);
  for (const id of ids) search.append("id[]", id);

  const regionId = await resolveRegionId();
  if (regionId) search.set("region_id", regionId);

  const body = await request<ProductsResponse>(`/store/products?${search.toString()}`);
  // Medusa does not guarantee the response preserves the `id[]` order; re-sort to match.
  const byId = new Map(body.products.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter((product): product is StoreProduct => Boolean(product));
}

/**
 * Resolves products for a set of variant ids (used by the wishlist, which only stores
 * `variant_id`). The store product list route does not expose a documented `variants.id[]`
 * filter, so this loads the published catalogue once and matches in memory — correct and
 * simple at the catalogue sizes v1 ships with; worth revisiting with a dedicated route if the
 * catalogue grows into the thousands.
 */
export async function fetchProductsForVariants(
  variantIds: string[],
): Promise<Map<string, { product: StoreProduct; variant: StoreVariant }>> {
  const result = new Map<string, { product: StoreProduct; variant: StoreVariant }>();
  if (variantIds.length === 0) return result;

  const wanted = new Set(variantIds);
  const { products } = await fetchProducts({ limit: 200 });
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (wanted.has(variant.id)) result.set(variant.id, { product, variant });
    }
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Search (custom /store/search/suggest + store product search)            */
/* -------------------------------------------------------------------------- */

export interface SearchSuggestion {
  products: { id: string; title: string; handle: string; thumbnail: string | null }[];
  brands: { id: string; name: string; handle: string }[];
}

export async function fetchSearchSuggestions(q: string): Promise<SearchSuggestion> {
  if (q.trim().length < 2) return { products: [], brands: [] };
  return request<SearchSuggestion>(`/store/search/suggest?q=${encodeURIComponent(q)}`);
}

/* -------------------------------------------------------------------------- */
/*  Home content + CMS (custom routes)                                       */
/* -------------------------------------------------------------------------- */

export interface BannerSlot {
  id: string;
  placement: string;
  image_url: string | null;
  headline: string | null;
  subhead: string | null;
  cta_label: string | null;
  cta_href: string | null;
}

export async function fetchHomeBanners(): Promise<BannerSlot[]> {
  const body = await request<{ banners: BannerSlot[] }>("/store/content/home", { revalidate: 60 });
  return body.banners;
}

export interface ResaleActivityItem {
  product_title: string;
  variant_title: string | null;
  unit_price: number;
  created_at: string;
}

/** Real recent order lines only — see docs/BUILD_LOG.md on the D2 fix that removed the
 * previous hardcoded "Live Marketplace Trades" ticker. No mock fallback. */
export async function fetchRecentActivity(): Promise<ResaleActivityItem[]> {
  const body = await request<{ activity: ResaleActivityItem[] }>("/store/resale/recent-activity", {
    revalidate: 30,
  });
  return body.activity;
}

export interface CmsPage {
  slug: string;
  kind: string;
  title: string;
  body_md: string;
  blocks: unknown;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
}

export async function fetchCmsPage(slug: string): Promise<CmsPage | null> {
  try {
    const body = await request<{ page: CmsPage }>(`/store/cms/${slug}`, { revalidate: 60 });
    return body.page;
  } catch (error) {
    if (error instanceof MedusaError && error.status === 404) return null;
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Customer auth (stock Medusa /auth and /store/customers routes)           */
/* -------------------------------------------------------------------------- */

/**
 * Medusa 2.x customer auth is emailpass via the generic `/auth/:actor_type/:auth_provider`
 * routes (verified against the installed @medusajs/medusa package — see docs/BUILD_LOG.md for
 * how). There is no separate "register"/"login" endpoint name: registering an auth identity,
 * creating the customer record and logging in are three distinct calls.
 */
const AUTH_PROVIDER_PATH = "/auth/customer/emailpass";

export class AuthError extends MedusaError {}

/** Step 1 of registration: create the auth identity, returns an actorless token. */
export async function authRegister(email: string, password: string): Promise<string> {
  const body = await request<{ token: string }>(`${AUTH_PROVIDER_PATH}/register`, {
    method: "POST",
    body: { email, password },
  });
  return body.token;
}

export interface StoreCustomer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  has_account?: boolean;
  metadata?: Record<string, unknown> | null;
}

/** Step 2: attach a customer record to the actorless identity from `authRegister`. */
export async function createCustomerAccount(
  registrationToken: string,
  data: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<StoreCustomer> {
  const body = await authRequest<{ customer: StoreCustomer }>("/store/customers", registrationToken, {
    method: "POST",
    body: data,
  });
  return body.customer;
}

/** Login (also used right after registration to mint a token with the customer attached). */
export async function authLogin(email: string, password: string): Promise<string> {
  const body = await request<{ token: string }>(AUTH_PROVIDER_PATH, {
    method: "POST",
    body: { email, password },
  });
  return body.token;
}

export async function requestPasswordReset(email: string): Promise<void> {
  // Always 201 — Medusa never reveals whether the address has an account (docs/API_PLAN.md §1).
  await request<void>(`${AUTH_PROVIDER_PATH}/reset-password`, {
    method: "POST",
    body: { identifier: email },
  });
}

/** Completes a password reset using the token from the emailed link (`purpose: "reset"` JWT). */
export async function confirmPasswordReset(resetToken: string, password: string): Promise<void> {
  await authRequest<{ success: boolean }>(`${AUTH_PROVIDER_PATH}/update`, resetToken, {
    method: "POST",
    body: { password },
  });
}

export async function fetchMe(token: string): Promise<StoreCustomer | null> {
  try {
    const body = await authRequest<{ customer: StoreCustomer }>(
      "/store/customers/me?fields=id,email,first_name,last_name,phone,metadata",
      token,
    );
    return body.customer;
  } catch (error) {
    if (error instanceof MedusaError && error.status === 401) return null;
    throw error;
  }
}

export async function updateMe(
  token: string,
  data: { first_name?: string; last_name?: string; phone?: string },
): Promise<StoreCustomer> {
  const body = await authRequest<{ customer: StoreCustomer }>("/store/customers/me", token, {
    method: "POST",
    body: data,
  });
  return body.customer;
}

export interface StoreAddress {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country_code: string | null;
  metadata?: Record<string, unknown> | null;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
}

export async function listAddresses(token: string): Promise<StoreAddress[]> {
  const body = await authRequest<{ addresses: StoreAddress[] }>(
    "/store/customers/me/addresses",
    token,
  );
  return body.addresses;
}

export async function createAddress(
  token: string,
  data: Record<string, unknown>,
): Promise<StoreAddress> {
  const body = await authRequest<{ customer: { addresses: StoreAddress[] } }>(
    "/store/customers/me/addresses",
    token,
    { method: "POST", body: data },
  );
  return body.customer.addresses[body.customer.addresses.length - 1] as StoreAddress;
}

export async function updateAddress(
  token: string,
  addressId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await authRequest(`/store/customers/me/addresses/${addressId}`, token, {
    method: "POST",
    body: data,
  });
}

export async function deleteAddress(token: string, addressId: string): Promise<void> {
  await authRequest(`/store/customers/me/addresses/${addressId}`, token, { method: "DELETE" });
}

/* -------------------------------------------------------------------------- */
/*  OTP (custom /store/otp routes)                                           */
/* -------------------------------------------------------------------------- */

export interface OtpSendResult {
  challenge_id: string;
  expires_at: string;
  channel: string;
  delivered: boolean;
  delivery_note?: string;
  dev_code?: string;
}

export async function sendOtp(input: {
  destination: string;
  channel: "email" | "sms";
  purpose: string;
}): Promise<OtpSendResult> {
  return request<OtpSendResult>("/store/otp/send", { method: "POST", body: input });
}

export async function verifyOtp(input: {
  challenge_id: string;
  code: string;
}): Promise<{ verified: boolean; destination: string; purpose: string }> {
  return request("/store/otp/verify", { method: "POST", body: input });
}

/* -------------------------------------------------------------------------- */
/*  Orders (stock /store/orders + custom shipment route)                     */
/* -------------------------------------------------------------------------- */

export interface StoreOrderItem {
  id: string;
  title: string;
  variant_title?: string | null;
  product_title?: string | null;
  product_handle?: string | null;
  thumbnail?: string | null;
  quantity: number;
  unit_price: number;
  total?: number;
  tax_total?: number;
  metadata?: Record<string, unknown> | null;
  product?: { metadata?: Record<string, unknown> | null } | null;
}

export interface StoreOrder {
  id: string;
  display_id: number;
  status: string;
  fulfillment_status?: string;
  payment_status?: string;
  email: string;
  currency_code: string;
  total: number;
  subtotal?: number;
  shipping_total?: number;
  tax_total?: number;
  created_at: string;
  customer_id?: string | null;
  metadata?: Record<string, unknown> | null;
  items?: StoreOrderItem[];
  shipping_address?: StoreAddress | null;
}

const ORDER_FIELDS =
  "id,display_id,status,fulfillment_status,payment_status,email,currency_code,total,subtotal,shipping_total,tax_total,created_at,customer_id,metadata,*items,items.metadata,items.product.metadata,*shipping_address";

export async function listMyOrders(
  token: string,
  params?: { limit?: number; offset?: number; status?: string },
): Promise<{ orders: StoreOrder[]; count: number }> {
  const search = new URLSearchParams();
  search.set("fields", ORDER_FIELDS);
  search.set("limit", String(params?.limit ?? 20));
  search.set("offset", String(params?.offset ?? 0));
  search.set("order", "-created_at");
  if (params?.status) search.set("status", params.status);
  return authRequest(`/store/orders?${search.toString()}`, token);
}

/**
 * Medusa's `/store/orders/:id` is intentionally unauthenticated (the order id is the secret —
 * see the route's own doc comment in @medusajs/medusa). Ownership for the account area is
 * therefore enforced here: the caller passes the signed-in customer id (or null for the
 * just-placed-order confirmation screen) and a mismatch renders as "not found", never a 403
 * that would confirm the order exists (docs/API_PLAN.md §1).
 */
export async function fetchOrder(orderId: string): Promise<StoreOrder | null> {
  try {
    const body = await request<{ order: StoreOrder }>(
      `/store/orders/${orderId}?fields=${encodeURIComponent(ORDER_FIELDS)}`,
    );
    return body.order;
  } catch (error) {
    if (error instanceof MedusaError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export async function cancelMyOrder(token: string, orderId: string, reason?: string): Promise<{ success: boolean }> {
  return authRequest(`/store/orders/${orderId}/cancel`, token, {
    method: "POST",
    body: { reason },
  });
}

export interface ShipmentTimeline {
  shipment: {
    id: string;
    awb: string | null;
    courier: string | null;
    status: string;
    status_label: string;
    stale: boolean;
    label_url: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
  } | null;
  events: { status: string; label: string; occurred_at: string }[];
}

export async function fetchOrderShipment(token: string, orderId: string): Promise<ShipmentTimeline> {
  return authRequest(`/store/orders/${orderId}/shipment`, token);
}

/* -------------------------------------------------------------------------- */
/*  Wishlist (custom /store/wishlist routes)                                 */
/* -------------------------------------------------------------------------- */

export interface WishlistItem {
  id: string;
  customer_id: string;
  variant_id: string;
  created_at?: string;
}

export async function fetchWishlist(token: string): Promise<WishlistItem[]> {
  const body = await authRequest<{ items: WishlistItem[] }>("/store/wishlist", token);
  return body.items;
}

export async function addToWishlist(token: string, variantId: string): Promise<void> {
  await authRequest("/store/wishlist", token, { method: "POST", body: { variant_id: variantId } });
}

export async function removeFromWishlist(token: string, variantId: string): Promise<void> {
  await authRequest(`/store/wishlist?variant_id=${encodeURIComponent(variantId)}`, token, {
    method: "DELETE",
  });
}

/* -------------------------------------------------------------------------- */
/*  Returns (custom /store/returns routes)                                   */
/* -------------------------------------------------------------------------- */

export interface StoreReturnRequest {
  id: string;
  display_id: string;
  order_id: string;
  status: string;
  reason_code: string;
  reason_note: string | null;
  resolution: string;
  refund_amount: number | null;
  requested_at: string | null;
  approved_at: string | null;
  received_at: string | null;
  closed_at: string | null;
}

export async function listMyReturns(token: string): Promise<StoreReturnRequest[]> {
  const body = await authRequest<{ returns: StoreReturnRequest[] }>("/store/return-requests", token);
  return body.returns;
}

export async function createReturnRequest(
  token: string,
  input: {
    order_id: string;
    reason_code: string;
    note?: string;
    items: { order_item_id: string; quantity: number }[];
  },
): Promise<StoreReturnRequest> {
  const body = await authRequest<{ return: StoreReturnRequest }>("/store/return-requests", token, {
    method: "POST",
    body: input,
  });
  return body.return;
}

/* -------------------------------------------------------------------------- */
/*  Checkout (stock Medusa cart/shipping/payment routes)                     */
/* -------------------------------------------------------------------------- */

export interface AddressPayload {
  first_name: string;
  last_name: string;
  phone: string;
  address_1: string;
  address_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  company?: string;
  metadata?: Record<string, unknown>;
}

/** Sets the cart's email + shipping/billing address (billing mirrors shipping in v1). */
export async function setCartAddress(
  cartId: string,
  email: string,
  address: AddressPayload,
  token?: string,
): Promise<StoreCart> {
  const body = token
    ? await authRequest<{ cart: StoreCart }>(`/store/carts/${cartId}`, token, {
        method: "POST",
        body: { email, shipping_address: address, billing_address: address },
      })
    : await request<{ cart: StoreCart }>(`/store/carts/${cartId}`, {
        method: "POST",
        body: { email, shipping_address: address, billing_address: address },
      });
  return body.cart;
}

export interface ShippingOption {
  id: string;
  name: string;
  amount?: number | null;
  calculated_price?: { calculated_amount: number | null } | null;
}

export async function listShippingOptions(cartId: string): Promise<ShippingOption[]> {
  const body = await request<{ shipping_options: ShippingOption[] }>(
    `/store/shipping-options?cart_id=${cartId}`,
  );
  return body.shipping_options;
}

export async function selectShippingOption(cartId: string, optionId: string): Promise<StoreCart> {
  const body = await request<{ cart: StoreCart }>(`/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    body: { option_id: optionId },
  });
  return body.cart;
}

export async function listRegionPaymentProviders(regionId: string): Promise<{ id: string }[]> {
  const body = await request<{ payment_providers: { id: string }[] }>(
    `/store/payment-providers?region_id=${regionId}`,
  );
  return body.payment_providers;
}

export interface PaymentCollection {
  id: string;
  payment_sessions?: { id: string; provider_id: string; status: string; data?: Record<string, unknown> }[];
}

export async function createPaymentCollection(cartId: string): Promise<PaymentCollection> {
  const body = await request<{ payment_collection: PaymentCollection }>("/store/payment-collections", {
    method: "POST",
    body: { cart_id: cartId },
  });
  return body.payment_collection;
}

/** `providerId` is the full stored id, e.g. `pp_razorpay_razorpay` for online payment. */
export async function createPaymentSession(
  collectionId: string,
  providerId: string,
): Promise<PaymentCollection> {
  const body = await request<{ payment_collection: PaymentCollection }>(
    `/store/payment-collections/${collectionId}/payment-sessions`,
    { method: "POST", body: { provider_id: providerId } },
  );
  return body.payment_collection;
}

export type CompleteCartResult =
  | { type: "order"; order: StoreOrder }
  | { type: "cart"; cart: StoreCart; error: { message: string; type: string } };

/**
 * The only call that may create a real order. Never trust a browser redirect: this runs
 * server-side and the confirmation screen only renders after re-reading the order back with
 * `fetchOrder` (docs/PROJECT_PLAN.md §6, ORDER_STATE_MACHINE.md).
 */
export async function completeCart(cartId: string): Promise<CompleteCartResult> {
  return request<CompleteCartResult>(`/store/carts/${cartId}/complete`, { method: "POST" });
}

/** Attaches the Razorpay checkout result to the payment session before completing the cart. */
export async function updatePaymentSession(
  collectionId: string,
  sessionId: string,
  data: Record<string, unknown>,
): Promise<PaymentCollection> {
  const body = await request<{ payment_collection: PaymentCollection }>(
    `/store/payment-collections/${collectionId}/payment-sessions/${sessionId}`,
    { method: "POST", body: { data } },
  );
  return body.payment_collection;
}

/* -------------------------------------------------------------------------- */
/*  Compliance & support (custom routes)                                     */
/* -------------------------------------------------------------------------- */

export async function deleteCustomerAccount(token: string): Promise<{ deleted: boolean }> {
  return authRequest("/store/customers/me/delete-account", token, { method: "DELETE" });
}

export interface SupportTicketInput {
  name: string;
  email: string;
  phone?: string;
  order_id?: string;
  category: string;
  subject: string;
  message: string;
}

export async function createSupportTicket(
  input: SupportTicketInput,
  token?: string,
): Promise<{ ticket: { display_id: string; status: string } }> {
  return token
    ? authRequest("/store/support/tickets", token, { method: "POST", body: input })
    : request("/store/support/tickets", { method: "POST", body: input });
}

