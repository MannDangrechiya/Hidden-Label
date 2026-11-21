import type {
  ShiprocketAuthResponse,
  ShiprocketServiceabilityRequest,
  ShiprocketServiceabilityResponse,
  ShiprocketPickupLocation,
  ShiprocketCreateOrderRequest,
  ShiprocketCreateOrderResponse,
  ShiprocketAssignAwbRequest,
  ShiprocketAssignAwbResponse,
  ShiprocketGenerateLabelResponse,
  ShiprocketTrackResponse,
  ShiprocketCancelOrderResponse,
  ShiprocketCreateReturnRequest,
  ShiprocketCreateReturnResponse,
} from "./types";

/**
 * Universal Shiprocket Provider Interface.
 * Implemented by both the production HTTP client and the local sandbox emulator,
 * ensuring zero behavioral divergence across the application.
 */
export interface IShiprocketClient {
  readonly isMock: boolean;

  /**
   * Authenticates and returns a valid bearer token.
   * Caches token automatically until expiration.
   */
  login(email?: string, password?: string): Promise<ShiprocketAuthResponse>;

  /**
   * Queries available courier companies and pricing between pickup and delivery pin codes.
   */
  checkServiceability(
    params: ShiprocketServiceabilityRequest,
  ): Promise<ShiprocketServiceabilityResponse>;

  /**
   * Fetches all registered warehouse pickup locations from Shiprocket settings.
   */
  getPickupLocations(): Promise<ShiprocketPickupLocation[]>;

  /**
   * Creates an outbound forwarding order in Shiprocket.
   */
  createOrder(
    payload: ShiprocketCreateOrderRequest,
  ): Promise<ShiprocketCreateOrderResponse>;

  /**
   * Generates and assigns an AWB to a created shipment.
   */
  assignAwb(
    payload: ShiprocketAssignAwbRequest,
  ): Promise<ShiprocketAssignAwbResponse>;

  /**
   * Generates shipping label PDF for one or more shipment IDs.
   */
  generateLabel(
    shipmentIds: number[],
  ): Promise<ShiprocketGenerateLabelResponse>;

  /**
   * Tracks an active shipment by its AWB code.
   */
  trackAwb(awbCode: string): Promise<ShiprocketTrackResponse>;

  /**
   * Cancels one or more Shiprocket orders by internal order ID.
   */
  cancelOrder(
    shiprocketOrderIds: number[],
  ): Promise<ShiprocketCancelOrderResponse>;

  /**
   * Creates a reverse pickup return order in Shiprocket.
   */
  createReturn(
    payload: ShiprocketCreateReturnRequest,
  ): Promise<ShiprocketCreateReturnResponse>;
}
