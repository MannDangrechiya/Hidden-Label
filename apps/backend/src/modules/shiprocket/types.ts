/**
 * Shiprocket API v1 types conforming strictly to the official API contract
 * Reference: https://apidocs.shiprocket.in/
 */

export interface ShiprocketAuthRequest {
  email: string;
  password: string;
}

export interface ShiprocketAuthResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company_id: number;
  created_at: string;
  token: string;
}

export interface ShiprocketServiceabilityRequest {
  pickup_postcode: string | number;
  delivery_postcode: string | number;
  weight: number | string; // In kg
  cod?: 0 | 1; // 0 for prepaid, 1 for cod
  declared_value?: number;
  is_return?: 0 | 1;
}

export interface AvailableCourierCompany {
  courier_company_id: number;
  courier_name: string;
  rate: number;
  etd: string;
  estimated_delivery_days: string;
  rating?: number;
  call_courier?: number;
  cutoff_time?: string;
  is_surface?: boolean;
}

export interface ShiprocketServiceabilityResponse {
  status: number;
  data: {
    available_courier_companies: AvailableCourierCompany[];
    recommended_courier_company_id?: number | null;
  };
}

export interface ShiprocketPickupLocation {
  id: number;
  pickup_location: string; // The nickname string (e.g. "Primary Warehouse")
  name: string;
  email: string;
  phone: string;
  address: string;
  address_2?: string | null;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  status: number;
}

export interface ShiprocketPickupLocationsResponse {
  data: {
    shipping_address: ShiprocketPickupLocation[];
  };
}

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: string | number;
}

export interface ShiprocketCreateOrderRequest {
  order_id: string; // Merchant order ID (e.g. "THL-68")
  order_date: string; // "YYYY-MM-DD HH:mm"
  pickup_location: string; // Warehouse nickname registered in Shiprocket
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_email?: string;
  shipping_phone?: string;
  order_items: ShiprocketOrderItem[];
  payment_method: "Prepaid" | "COD";
  shipping_charges?: number;
  giftwrap_charges?: number;
  transaction_charges?: number;
  total_discount?: number;
  sub_total: number;
  length: number; // In cm
  breadth: number; // In cm
  height: number; // In cm
  weight: number; // In kg
}

export interface ShiprocketCreateOrderResponse {
  order_id: number; // Shiprocket internal order ID
  shipment_id: number; // Shiprocket internal shipment ID
  status: string; // e.g. "NEW"
  status_code: number;
  onboarding_completed_now?: number;
  awb_code?: string;
  courier_company_id?: string;
  courier_name?: string;
}

export interface ShiprocketAssignAwbRequest {
  shipment_id: number;
  courier_id?: number;
  status?: string;
}

export interface ShiprocketAssignAwbResponse {
  response: {
    data: {
      awb_code: string;
      courier_company_id: number;
      courier_name: string;
      shipment_id: number;
      routing_code?: string;
      rto_routing_code?: string;
      applied_weight?: number;
    };
  };
}

export interface ShiprocketGenerateLabelRequest {
  shipment_id: number[];
}

export interface ShiprocketGenerateLabelResponse {
  label_created: number;
  label_url: string;
  response?: string;
  is_mock?: boolean;
}

export interface ShiprocketTrackActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
  "sr-status"?: string;
}

export interface ShiprocketTrackData {
  track_status: number;
  shipment_status: number;
  shipment_track: Array<{
    id: number;
    awb_code: string;
    current_status: string;
    origin: string;
    destination: string;
    consignee_name?: string;
    location?: string;
    date?: string;
  }>;
  shipment_track_activities?: ShiprocketTrackActivity[];
  track_url?: string;
}

export interface ShiprocketTrackResponse {
  tracking_data: ShiprocketTrackData;
}

export interface ShiprocketCancelOrderRequest {
  ids: number[]; // Array of Shiprocket order IDs
}

export interface ShiprocketCancelOrderResponse {
  message: string;
  status: number;
}

export interface ShiprocketCreateReturnRequest {
  order_id: string; // RMA display ID (e.g. "RMA-1001")
  order_date: string; // "YYYY-MM-DD"
  channel_id?: string;
  pickup_customer_name: string;
  pickup_last_name?: string;
  pickup_address: string;
  pickup_address_2?: string;
  pickup_city: string;
  pickup_state: string;
  pickup_country: string;
  pickup_pincode: string;
  pickup_email: string;
  pickup_phone: string;
  shipping_customer_name: string; // Return warehouse name
  shipping_address: string;
  shipping_address_2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_country: string;
  shipping_pincode: string;
  shipping_phone: string;
  order_items: ShiprocketOrderItem[];
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface ShiprocketCreateReturnResponse {
  order_id: number;
  shipment_id: number;
  status: string;
  status_code: number;
  awb_code?: string;
  courier_company_id?: number;
  courier_name?: string;
}

export interface ShiprocketWebhookPayload {
  awb?: string;
  courier_name?: string;
  current_status?: string;
  current_status_id?: number;
  shipment_status?: string;
  shipment_status_id?: number;
  order_id?: string | number;
  sr_order_id?: number;
  shipment_id?: string | number;
  scan_date?: string;
  scans?: Array<{
    date: string;
    status: string;
    activity: string;
    location: string;
  }>;
  etd?: string;
  event?: string;
}
