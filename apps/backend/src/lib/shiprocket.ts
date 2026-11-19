/**
 * Shiprocket API client — real HTTP calls, no mock responses.
 *
 * D2/P6: credentials are read from env (`SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD`/
 * `SHIPROCKET_PICKUP_LOCATION`). Without them `isConfigured()` is false and every caller here
 * must fall back to a manual-dispatch path rather than claiming a Shiprocket shipment exists.
 * Never record a `provider: "shiprocket"` shipment row unless this client actually returned a
 * real shipment id / AWB from Shiprocket's API.
 *
 * Shiprocket's own docs: https://apidocs.shiprocket.in/ — this client has not been exercised
 * against their live API (no sandbox credentials available in this environment). The shapes
 * below follow their documented v1 external API; verify field names against a real response
 * before going live and adjust if their API has since changed.
 */

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new Error("Shiprocket is not configured (SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD missing).");
  }

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Shiprocket auth failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { token: string };
  // Shiprocket tokens are valid for ~10 days; refresh well before that to stay safe.
  cachedToken = { token: body.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return cachedToken.token;
}

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
}

export interface CreateShiprocketOrderInput {
  orderId: string;
  orderDisplayId: string;
  orderDate: string;
  customerName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  items: ShiprocketOrderItem[];
  subTotalRupees: number;
  paymentMethod: "COD" | "Prepaid";
  weightKg?: number;
  /** Real parcel dimensions; omit only when nothing better than the default box is known. */
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

export interface ShiprocketOrderResult {
  shiprocketOrderId: string;
  shipmentId: string;
  awb: string | null;
  courierName: string | null;
  labelUrl: string | null;
}

/**
 * Creates a real Shiprocket order + (if auto-assignment is on) a shipment. Throws on any
 * failure — the caller must catch and fall back to manual dispatch, never silently succeed.
 */
export async function createShiprocketOrder(
  input: CreateShiprocketOrderInput,
): Promise<ShiprocketOrderResult> {
  const token = await getToken();
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
  if (!pickupLocation) {
    throw new Error("SHIPROCKET_PICKUP_LOCATION is not set.");
  }

  const response = await fetch(`${BASE_URL}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: input.orderDisplayId,
      order_date: input.orderDate,
      pickup_location: pickupLocation,
      billing_customer_name: input.customerName,
      billing_address: input.addressLine1,
      billing_address_2: input.addressLine2 ?? "",
      billing_city: input.city,
      billing_state: input.state,
      billing_pincode: input.pincode,
      billing_country: "India",
      billing_phone: input.phone,
      billing_email: input.email,
      shipping_is_billing: true,
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.units,
        selling_price: item.selling_price,
      })),
      payment_method: input.paymentMethod,
      sub_total: input.subTotalRupees,
      length: input.lengthCm ?? 30,
      breadth: input.breadthCm ?? 20,
      height: input.heightCm ?? 12,
      weight: input.weightKg ?? 0.6,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Shiprocket order create failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    order_id: number | string;
    shipment_id: number | string;
    awb_code?: string;
    courier_name?: string;
    label_url?: string;
  };

  return {
    shiprocketOrderId: String(body.order_id),
    shipmentId: String(body.shipment_id),
    awb: body.awb_code ?? null,
    courierName: body.courier_name ?? null,
    labelUrl: body.label_url ?? null,
  };
}

export interface CreateShiprocketReturnInput {
  rmaNumber: string;
  originalOrderDisplayId: string;
  pickupCustomerName: string;
  pickupAddressLine1: string;
  pickupAddressLine2?: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
  pickupPhone: string;
  pickupEmail: string;
  items: ShiprocketOrderItem[];
  subTotalRupees: number;
  weightKg?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

/**
 * GAP-LOG-04: reverse pickup for an approved return. Shiprocket creates a return order, the
 * caller stores the AWB on `return_request` so the customer sees the pickup tracking.
 * Throws on any failure — the admin flow records a manual pickup instead of inventing an AWB.
 */
export async function createShiprocketReturn(
  input: CreateShiprocketReturnInput,
): Promise<ShiprocketOrderResult> {
  const token = await getToken();
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
  if (!pickupLocation) {
    throw new Error("SHIPROCKET_PICKUP_LOCATION is not set.");
  }

  const response = await fetch(`${BASE_URL}/orders/create/return`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order_id: input.rmaNumber,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_customer_name: input.pickupCustomerName,
      pickup_address: input.pickupAddressLine1,
      pickup_address_2: input.pickupAddressLine2 ?? "",
      pickup_city: input.pickupCity,
      pickup_state: input.pickupState,
      pickup_pincode: input.pickupPincode,
      pickup_country: "India",
      pickup_phone: input.pickupPhone,
      pickup_email: input.pickupEmail,
      shipping_customer_name: "The Hidden Label Returns",
      shipping_address: pickupLocation,
      shipping_city: "Ahmedabad",
      shipping_state: "Gujarat",
      shipping_pincode: "380054",
      shipping_country: "India",
      shipping_phone: "9999999999",
      shipping_is_billing: true,
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.units,
        selling_price: item.selling_price,
      })),
      payment_method: "Prepaid",
      sub_total: input.subTotalRupees,
      length: input.lengthCm ?? 30,
      breadth: input.breadthCm ?? 20,
      height: input.heightCm ?? 12,
      weight: input.weightKg ?? 0.6,
      request_pickup: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Shiprocket return create failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as {
    order_id?: number | string;
    shipment_id?: number | string;
    awb_code?: string;
    courier_name?: string;
    label_url?: string;
  };

  return {
    shiprocketOrderId: String(body.order_id ?? ""),
    shipmentId: String(body.shipment_id ?? ""),
    awb: body.awb_code ?? null,
    courierName: body.courier_name ?? null,
    labelUrl: body.label_url ?? null,
  };
}
