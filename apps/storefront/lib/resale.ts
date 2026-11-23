/**
 * Client & Server API helpers for Phase 5.5 Resale, Bidding, Inspection, and AI layer.
 */

const MEDUSA_URL =
  process.env.NEXT_PUBLIC_MEDUSA_URL || process.env.MEDUSA_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY || "";

function headers(token?: string): Record<string, string> {
  const base: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (PUBLISHABLE_KEY) base["x-publishable-api-key"] = PUBLISHABLE_KEY;
  if (token) base["authorization"] = `Bearer ${token}`;
  return base;
}

export interface PriceHistoryPoint {
  recorded_at: string;
  price_rupees: number;
  condition_grade: string;
  source: string;
}

export interface InspectionSummary {
  unit_serial: string;
  condition_grade: string;
  box_condition: string;
  inspected_at: string | null;
}

export interface VariantResaleData {
  variant_id: string;
  size: string;
  sku: string | null;
  lowest_ask: number | null;
  highest_bid: number | null;
  active_asks_count: number;
  active_bids_count: number;
  last_sale_price: number | null;
  change_pct_30d: number;
  high_52w: number | null;
  low_52w: number | null;
  price_history: PriceHistoryPoint[];
  inspection_summary: InspectionSummary | null;
}

export interface ResaleProductIndex {
  product: {
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
    description: string | null;
  };
  fit_rule: {
    silhouette: string;
    fit_tendency: string;
    size_delta: number;
    width_profile: string;
    guidance: string;
  } | null;
  variants: VariantResaleData[];
}

export interface InspectionCertificate {
  id: string;
  unit_serial: string;
  status: string;
  condition_grade: string;
  box_condition: string;
  turntable_media: string[];
  detail_photos: Array<{ label: string; url: string }>;
  checklist: Record<string, string | boolean>;
  notes: string | null;
  inspected_at: string | null;
  product: {
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
  };
  variant: {
    id: string;
    size: string;
    sku: string | null;
  };
}

export interface FitRecommendation {
  recommended_size: string;
  recommended_size_number: number;
  baseline_uk_size: number;
  total_delta: number;
  fit_tendency: string;
  width_applied: string;
  guidance: string;
  confidence_score: number;
  matched_silhouette: string;
}

export interface ConciergeMessageResponse {
  thread_id: string;
  reply: string;
  /** Issued by the backend when a new guest session is created. Persist it; never mint your own. */
  session_token?: string;
  recommended_products: Array<{
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
    brand: string;
  }>;
}

export interface SightSearchMatch {
  product: {
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
    brand: string;
  };
  similarity_score: number;
}

export async function fetchResaleProductIndex(handle: string): Promise<ResaleProductIndex | null> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/products/${encodeURIComponent(handle)}/index`, {
      headers: headers(),
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchInspectionCertificate(
  unitSerial: string,
): Promise<InspectionCertificate | null> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/inspections/${encodeURIComponent(unitSerial)}`, {
      headers: headers(),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.inspection ?? null;
  } catch {
    return null;
  }
}

export async function requestFitRecommendation(body: {
  foot_length_cm?: number;
  baseline_uk_size?: number;
  foot_width?: "narrow" | "regular" | "wide";
  silhouette_name?: string;
  product_handle?: string;
}): Promise<FitRecommendation | null> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/fit/recommend`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendConciergeMessage(body: {
  message: string;
  /** Backend-issued signed session. Omit on the first message. */
  session_token?: string;
  thread_id?: string;
}): Promise<ConciergeMessageResponse | null> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/concierge/chat`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function searchBySight(body: {
  silhouette_hint?: string;
  tags?: string[];
  image_url?: string;
}): Promise<SightSearchMatch[]> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/sight-search`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches ?? [];
  } catch {
    return [];
  }
}

export interface SellerAskRecord {
  id: string;
  variant_id: string;
  ask_price: number | string;
  condition_grade: string;
  box_condition: string;
  status: string;
  created_at: string;
  variant?: {
    size: string;
    sku: string | null;
  };
  product?: {
    id: string;
    title: string;
    handle: string;
    thumbnail: string | null;
  };
}

export interface SubmittedBid {
  id: string;
  variant_id: string;
  bid_price: number;
  status: string;
  expires_at: string;
}

/**
 * Server-side variant of `placeResaleBid`: the customer bearer token lives in an httpOnly cookie
 * and is never read by the browser, so the PDP bid modal goes through a Server Action that calls
 * this instead of fetching the backend from the client.
 */
export async function submitResaleBid(
  token: string,
  input: { variant_id: string; bid_price: number; expires_in_days?: number },
): Promise<{ success: boolean; error?: string; bid?: SubmittedBid }> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/bids`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return { success: false, error: err.message ?? "Could not place that bid." };
    }
    const data = (await res.json()) as { bid: SubmittedBid };
    return { success: true, bid: data.bid };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Could not reach the marketplace: ${error.message}`
          : "Could not reach the marketplace.",
    };
  }
}

export async function placeResaleBid(
  variantId: string,
  bidPrice: number,
  token: string,
): Promise<{ success: boolean; error?: string; bid?: unknown }> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/bids`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ variant_id: variantId, bid_price: bidPrice }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to place bid." }));
      return { success: false, error: err.message || "Failed to place bid." };
    }
    const data = await res.json();
    return { success: true, bid: data.bid };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function placeResaleAsk(
  variantId: string,
  askPrice: number,
  conditionGrade: string,
  boxCondition: string,
  token: string,
): Promise<{ success: boolean; error?: string; ask?: unknown }> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/asks`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        variant_id: variantId,
        ask_price: askPrice,
        condition_grade: conditionGrade,
        box_condition: boxCondition,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to list item for sale." }));
      return { success: false, error: err.message || "Failed to list item." };
    }
    const data = await res.json();
    return { success: true, ask: data.ask };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function listMyAsks(token: string): Promise<SellerAskRecord[]> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/asks`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.asks ?? [];
  } catch {
    return [];
  }
}

export async function cancelMyAsk(askId: string, token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/asks/${encodeURIComponent(askId)}`, {
      method: "DELETE",
      headers: headers(token),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to cancel listing." }));
      return { success: false, error: err.message || "Failed to cancel listing." };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export interface CustomerBidRecord {
  id: string;
  variant_id: string;
  bid_price: number;
  status: string;
  expires_at: string;
  created_at: string;
  variant: { size: string; sku: string | null };
  product: { id: string; title: string; handle: string; thumbnail: string | null };
}

/**
 * Signed-in customer's own bids. Uses the configured backend origin — the account page used to
 * fetch `http://localhost:9000` directly, which silently returned nothing on staging/production.
 */
export async function listMyBids(token: string): Promise<CustomerBidRecord[]> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/bids`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { bids?: CustomerBidRecord[] };
    return data.bids ?? [];
  } catch {
    return [];
  }
}

export async function cancelMyBid(
  bidId: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${MEDUSA_URL}/store/resale/bids/${encodeURIComponent(bidId)}`, {
      method: "DELETE",
      headers: headers(token),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return { success: false, error: err.message ?? "Failed to cancel bid." };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? `Could not reach the marketplace: ${e.message}` : "Network error",
    };
  }
}
