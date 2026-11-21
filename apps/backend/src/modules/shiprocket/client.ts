import type { IShiprocketClient } from "./client-interface";
import type {
  ShiprocketAuthResponse,
  ShiprocketServiceabilityRequest,
  ShiprocketServiceabilityResponse,
  ShiprocketPickupLocation,
  ShiprocketPickupLocationsResponse,
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

export interface ShiprocketClientConfig {
  baseUrl?: string;
  email?: string;
  password?: string;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: {
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
  };
}

export class ShiprocketApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(`Shiprocket API Error [${statusCode}]: ${message}`);
    this.name = "ShiprocketApiError";
  }
}

export class ShiprocketClient implements IShiprocketClient {
  public readonly isMock: boolean;
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly password: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly logger?: ShiprocketClientConfig["logger"];

  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: ShiprocketClientConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.SHIPROCKET_BASE_URL ||
      "https://apiv2.shiprocket.in/v1/external"
    ).replace(/\/+$/, "");

    this.email = config.email || process.env.SHIPROCKET_EMAIL || "";
    this.password = config.password || process.env.SHIPROCKET_PASSWORD || "";
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.logger = config.logger;

    this.isMock = this.baseUrl.includes("127.0.0.1") || this.baseUrl.includes("localhost");
  }

  /**
   * Returns a valid bearer token, using cached token if not expired.
   */
  async login(email?: string, password?: string): Promise<ShiprocketAuthResponse> {
    const userEmail = email || this.email;
    const userPassword = password || this.password;

    if (!userEmail || !userPassword) {
      throw new ShiprocketApiError("Missing Shiprocket email or password credentials.", 401);
    }

    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now) {
      return {
        id: 0,
        first_name: "The",
        last_name: "Hidden Label",
        email: userEmail,
        company_id: 0,
        created_at: new Date(now).toISOString(),
        token: this.cachedToken,
      };
    }

    const response = await this.executeRequest<ShiprocketAuthResponse>({
      endpoint: "/auth/login",
      method: "POST",
      body: { email: userEmail, password: userPassword },
      requiresAuth: false,
    });

    if (!response.token) {
      throw new ShiprocketApiError("Authentication response missing token.", 401, response);
    }

    this.cachedToken = response.token;
    // Shiprocket tokens last ~10 days; refresh proactively after 7 days (7 * 24 * 3600 * 1000)
    this.tokenExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return response;
  }

  async checkServiceability(
    params: ShiprocketServiceabilityRequest,
  ): Promise<ShiprocketServiceabilityResponse> {
    const query = new URLSearchParams({
      pickup_postcode: String(params.pickup_postcode),
      delivery_postcode: String(params.delivery_postcode),
      weight: String(params.weight),
      cod: String(params.cod ?? 0),
    });

    if (params.declared_value !== undefined) {
      query.set("declared_value", String(params.declared_value));
    }
    if (params.is_return !== undefined) {
      query.set("is_return", String(params.is_return));
    }

    return this.executeRequest<ShiprocketServiceabilityResponse>({
      endpoint: `/courier/serviceability/?${query.toString()}`,
      method: "GET",
    });
  }

  async getPickupLocations(): Promise<ShiprocketPickupLocation[]> {
    const res = await this.executeRequest<ShiprocketPickupLocationsResponse>({
      endpoint: "/settings/company/pickup",
      method: "GET",
    });

    return res.data?.shipping_address || [];
  }

  async createOrder(
    payload: ShiprocketCreateOrderRequest,
  ): Promise<ShiprocketCreateOrderResponse> {
    return this.executeRequest<ShiprocketCreateOrderResponse>({
      endpoint: "/orders/create/adhoc",
      method: "POST",
      body: payload,
    });
  }

  async assignAwb(
    payload: ShiprocketAssignAwbRequest,
  ): Promise<ShiprocketAssignAwbResponse> {
    return this.executeRequest<ShiprocketAssignAwbResponse>({
      endpoint: "/courier/assign/awb",
      method: "POST",
      body: payload,
    });
  }

  async generateLabel(
    shipmentIds: number[],
  ): Promise<ShiprocketGenerateLabelResponse> {
    return this.executeRequest<ShiprocketGenerateLabelResponse>({
      endpoint: "/courier/generate/label",
      method: "POST",
      body: { shipment_id: shipmentIds },
    });
  }

  async trackAwb(awbCode: string): Promise<ShiprocketTrackResponse> {
    return this.executeRequest<ShiprocketTrackResponse>({
      endpoint: `/courier/track/awb/${encodeURIComponent(awbCode)}`,
      method: "GET",
    });
  }

  async cancelOrder(
    shiprocketOrderIds: number[],
  ): Promise<ShiprocketCancelOrderResponse> {
    return this.executeRequest<ShiprocketCancelOrderResponse>({
      endpoint: "/orders/cancel",
      method: "POST",
      body: { ids: shiprocketOrderIds },
    });
  }

  async createReturn(
    payload: ShiprocketCreateReturnRequest,
  ): Promise<ShiprocketCreateReturnResponse> {
    return this.executeRequest<ShiprocketCreateReturnResponse>({
      endpoint: "/orders/create/return",
      method: "POST",
      body: payload,
    });
  }

  /**
   * Clears in-memory cached token (e.g. on 401 or test reset).
   */
  clearAuth(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  private async executeRequest<T>(options: {
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    requiresAuth?: boolean;
    retryCount?: number;
  }): Promise<T> {
    const { endpoint, method, body, requiresAuth = true, retryCount = 0 } = options;

    let token = this.cachedToken;
    if (requiresAuth) {
      if (!token || Date.now() >= this.tokenExpiresAt) {
        const auth = await this.login();
        token = auth.token;
      }
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (requiresAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Handle 401 Unauthorized (token may have been revoked or expired on server)
      if (response.status === 401 && requiresAuth && retryCount === 0) {
        this.clearAuth();
        this.logger?.warn("Shiprocket token rejected with 401; re-authenticating...");
        return this.executeRequest<T>({
          ...options,
          retryCount: retryCount + 1,
        });
      }

      const text = await response.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        const message =
          (data as { message?: string })?.message ||
          (data as { error?: string })?.error ||
          response.statusText;

        // If 5xx server error and retries remaining, retry with exponential backoff
        if (response.status >= 500 && retryCount < this.maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 500;
          this.logger?.warn(`Shiprocket 5xx error (${response.status}); retrying in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return this.executeRequest<T>({
            ...options,
            retryCount: retryCount + 1,
          });
        }

        throw new ShiprocketApiError(message, response.status, data);
      }

      return data as T;
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof ShiprocketApiError) {
        throw err;
      }

      const isAbort =
        controller.signal.aborted ||
        (err as { name?: string })?.name === "AbortError" ||
        (err as { cause?: { name?: string } })?.cause?.name === "AbortError";

      const message = isAbort
        ? `Request timed out after ${this.timeoutMs}ms`
        : (err as Error)?.message || "Network request failed";

      if (retryCount < this.maxRetries) {
        const backoffMs = Math.pow(2, retryCount) * 500;
        this.logger?.warn(`Shiprocket network failure (${message}); retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.executeRequest<T>({
          ...options,
          retryCount: retryCount + 1,
        });
      }

      throw new ShiprocketApiError(message, isAbort ? 504 : 503, { error: message });
    }
  }
}
