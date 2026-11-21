import http from "node:http";
import crypto from "node:crypto";
import type {
  ShiprocketCreateOrderRequest,
  ShiprocketAssignAwbRequest,
  ShiprocketCreateReturnRequest,
} from "./types";

export interface SandboxServerOptions {
  port?: number;
  host?: string;
  expectedEmail?: string;
  expectedPassword?: string;
}

export class ShiprocketSandboxServer {
  private server: http.Server | null = null;
  private port: number;
  private host: string;

  private expectedEmail: string;
  private expectedPassword: string;

  // Failure simulation flags
  private failAuth: boolean = false;
  private failServiceability: boolean = false;
  private failCouriers: boolean = false;
  private failAwb: boolean = false;
  private failLabel: boolean = false;
  private failCancel: boolean = false;
  private failReturn: boolean = false;
  private delayMs: number = 0;

  // In-memory mock database
  private orders: Map<number, Record<string, unknown>> = new Map();
  private shipments: Map<number, Record<string, unknown>> = new Map();
  private awbTracking: Map<string, Record<string, unknown>> = new Map();
  private nextOrderId: number = 100_000;
  private nextShipmentId: number = 200_000;

  constructor(options: SandboxServerOptions = {}) {
    this.port = options.port ?? 9098;
    this.host = options.host ?? "127.0.0.1";
    this.expectedEmail = options.expectedEmail ?? "operations@thehiddenlabel.com";
    this.expectedPassword = options.expectedPassword ?? "sandbox_secret_123";
  }

  // Configuration controls for tests
  public setFailAuth(fail: boolean): void {
    this.failAuth = fail;
  }
  public setFailServiceability(fail: boolean): void {
    this.failServiceability = fail;
  }
  public setFailCouriers(fail: boolean): void {
    this.failCouriers = fail;
  }
  public setFailAwb(fail: boolean): void {
    this.failAwb = fail;
  }
  public setFailLabel(fail: boolean): void {
    this.failLabel = fail;
  }
  public setFailCancel(fail: boolean): void {
    this.failCancel = fail;
  }
  public setFailReturn(fail: boolean): void {
    this.failReturn = fail;
  }
  public setDelayMs(ms: number): void {
    this.delayMs = ms;
  }

  public reset(): void {
    this.failAuth = false;
    this.failServiceability = false;
    this.failCouriers = false;
    this.failAwb = false;
    this.failLabel = false;
    this.failCancel = false;
    this.failReturn = false;
    this.delayMs = 0;
    this.orders.clear();
    this.shipments.clear();
    this.awbTracking.clear();
  }

  public getUrl(): string {
    return `http://${this.host}:${this.port}/v1/external`;
  }

  public async start(): Promise<void> {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message, is_mock: true }));
      });
    });

    const server = this.server;
    if (!server) throw new Error("Sandbox server not initialized");

    await new Promise<void>((resolve, reject) => {
      server.listen(this.port, this.host, () => resolve());
      server.on("error", reject);
    });
  }

  public async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    await new Promise<void>((resolve) => {
      server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url ?? "/", `http://${this.host}:${this.port}`);
    const pathname = parsedUrl.pathname;
    const method = req.method ?? "GET";

    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    // CORS & Common headers
    res.setHeader("Content-Type", "application/json");
    res.setHeader("x-shiprocket-mock", "true");

    // 1. Auth Login: POST /v1/external/auth/login
    if (pathname === "/v1/external/auth/login" && method === "POST") {
      const body = await this.readJsonBody<{ email?: string; password?: string }>(req);

      if (this.failAuth || body.email !== this.expectedEmail || body.password !== this.expectedPassword) {
        res.writeHead(401);
        res.end(
          JSON.stringify({
            message: "The email or password you entered is incorrect.",
            status_code: 401,
            is_mock: true,
          }),
        );
        return;
      }

      res.writeHead(200);
      res.end(
        JSON.stringify({
          id: 998877,
          first_name: "Mock",
          last_name: "Shiprocket",
          email: body.email,
          company_id: 112233,
          created_at: new Date().toISOString(),
          token: `mock_jwt_token_${crypto.randomBytes(16).toString("hex")}`,
          is_mock: true,
        }),
      );
      return;
    }

    // Enforce Bearer Token check for all remaining endpoints
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer mock_jwt_token_")) {
      res.writeHead(401);
      res.end(
        JSON.stringify({
          message: "Unauthenticated or invalid token.",
          status_code: 401,
          is_mock: true,
        }),
      );
      return;
    }

    // 2. Serviceability: GET /v1/external/courier/serviceability/
    if (pathname === "/v1/external/courier/serviceability/" && method === "GET") {
      if (this.failServiceability) {
        res.writeHead(500);
        res.end(JSON.stringify({ message: "Courier service down.", status_code: 500, is_mock: true }));
        return;
      }

      if (this.failCouriers) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: 200,
            data: {
              available_courier_companies: [],
              recommended_courier_company_id: null,
            },
            is_mock: true,
          }),
        );
        return;
      }

      const pickupPin = parsedUrl.searchParams.get("pickup_postcode");
      const deliveryPin = parsedUrl.searchParams.get("delivery_postcode");

      // Simulate pincode serviceability rules
      const isUnserviceable = deliveryPin === "999999" || pickupPin === "000000";

      if (isUnserviceable) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: 200,
            data: {
              available_courier_companies: [],
              recommended_courier_company_id: null,
            },
            is_mock: true,
          }),
        );
        return;
      }

      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: 200,
          data: {
            available_courier_companies: [
              {
                courier_company_id: 24,
                courier_name: "Delhivery Surface (Mock)",
                rate: 145.0,
                etd: "2-3 Days",
                estimated_delivery_days: "3",
                rating: 4.5,
              },
              {
                courier_company_id: 10,
                courier_name: "Bluedart Air (Mock)",
                rate: 220.0,
                etd: "1-2 Days",
                estimated_delivery_days: "2",
                rating: 4.8,
              },
            ],
            recommended_courier_company_id: 24,
          },
          is_mock: true,
        }),
      );
      return;
    }

    // 3. Pickup Locations: GET /v1/external/settings/company/pickup
    if (pathname === "/v1/external/settings/company/pickup" && method === "GET") {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          data: {
            shipping_address: [
              {
                id: 1001,
                pickup_location: "Primary Warehouse",
                name: "The Hidden Label Fulfillment",
                email: "logistics@thehiddenlabel.com",
                phone: "+919876543210",
                address: "Sindhu Bhavan Road, Bodakdev",
                address_2: null,
                city: "Ahmedabad",
                state: "Gujarat",
                country: "India",
                pin_code: "380054",
                status: 1,
              },
              {
                id: 1002,
                pickup_location: "Mumbai Hub",
                name: "The Hidden Label Express Hub",
                email: "mumbai.hub@thehiddenlabel.com",
                phone: "+919876543211",
                address: "Bandra Kurla Complex",
                address_2: null,
                city: "Mumbai",
                state: "Maharashtra",
                country: "India",
                pin_code: "400051",
                status: 1,
              },
            ],
          },
          is_mock: true,
        }),
      );
      return;
    }

    // 4. Create Forwarding Order: POST /v1/external/orders/create/adhoc
    if (pathname === "/v1/external/orders/create/adhoc" && method === "POST") {
      const body = await this.readJsonBody<ShiprocketCreateOrderRequest>(req);

      if (!body.order_id || !body.pickup_location || !body.order_items?.length) {
        res.writeHead(422);
        res.end(
          JSON.stringify({
            message: "Missing mandatory fields (order_id, pickup_location, order_items).",
            status_code: 422,
            is_mock: true,
          }),
        );
        return;
      }

      this.nextOrderId += 1;
      this.nextShipmentId += 1;
      const orderId = this.nextOrderId;
      const shipmentId = this.nextShipmentId;

      const orderRecord = {
        order_id: orderId,
        shipment_id: shipmentId,
        merchant_order_id: body.order_id,
        pickup_location: body.pickup_location,
        status: "NEW",
        created_at: new Date().toISOString(),
        request: body,
      };

      this.orders.set(orderId, orderRecord);
      this.shipments.set(shipmentId, orderRecord);

      res.writeHead(200);
      res.end(
        JSON.stringify({
          order_id: orderId,
          shipment_id: shipmentId,
          status: "NEW",
          status_code: 1,
          onboarding_completed_now: 0,
          awb_code: "",
          courier_company_id: "",
          courier_name: "",
          is_mock: true,
        }),
      );
      return;
    }

    // 5. Assign AWB: POST /v1/external/courier/assign/awb
    if (pathname === "/v1/external/courier/assign/awb" && method === "POST") {
      if (this.failAwb) {
        res.writeHead(422);
        res.end(
          JSON.stringify({
            message: "Unable to assign AWB with chosen courier.",
            status_code: 422,
            is_mock: true,
          }),
        );
        return;
      }

      const body = await this.readJsonBody<ShiprocketAssignAwbRequest>(req);
      const shipment = this.shipments.get(body.shipment_id);

      if (!shipment) {
        res.writeHead(404);
        res.end(JSON.stringify({ message: "Shipment not found.", status_code: 404, is_mock: true }));
        return;
      }

      const courierId = body.courier_id ?? 24;
      const courierName = courierId === 10 ? "Bluedart Air (Mock)" : "Delhivery Surface (Mock)";
      const awbCode = `SRMOCK${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      shipment.awb = awbCode;
      shipment.courier = courierName;
      shipment.courier_company_id = courierId;
      shipment.status = "AWB_ASSIGNED";

      // Seed tracking entry
      this.awbTracking.set(awbCode, {
        awb_code: awbCode,
        current_status: "PICKUP SCHEDULED",
        origin: "Ahmedabad",
        destination: "Customer Destination",
        courier_name: courierName,
      });

      res.writeHead(200);
      res.end(
        JSON.stringify({
          response: {
            data: {
              awb_code: awbCode,
              courier_company_id: courierId,
              courier_name: courierName,
              shipment_id: body.shipment_id,
              routing_code: "MOCK-RT-01",
              is_mock: true,
            },
          },
          is_mock: true,
        }),
      );
      return;
    }

    // 6. Generate Label: POST /v1/external/courier/generate/label
    if (pathname === "/v1/external/courier/generate/label" && method === "POST") {
      if (this.failLabel) {
        res.writeHead(500);
        res.end(JSON.stringify({ message: "Failed to render PDF label.", is_mock: true }));
        return;
      }

      const body = await this.readJsonBody<{ shipment_id: number[] }>(req);
      const firstId = body.shipment_id?.[0] ?? 0;
      const labelUrl = `http://${this.host}:${this.port}/mock-labels/label_${firstId}.pdf`;

      res.writeHead(200);
      res.end(
        JSON.stringify({
          label_created: 1,
          label_url: labelUrl,
          response: "Label generated successfully (Mock)",
          is_mock: true,
        }),
      );
      return;
    }

    // 7. Track AWB: GET /v1/external/courier/track/awb/:awb_code
    if (pathname.startsWith("/v1/external/courier/track/awb/") && method === "GET") {
      const awb = decodeURIComponent(pathname.replace("/v1/external/courier/track/awb/", ""));
      const track = this.awbTracking.get(awb);

      if (!track && !awb.startsWith("SRMOCK")) {
        res.writeHead(404);
        res.end(JSON.stringify({ message: "Tracking data not found for AWB.", is_mock: true }));
        return;
      }

      const currentStatus = (track?.current_status as string) || "IN TRANSIT";

      res.writeHead(200);
      res.end(
        JSON.stringify({
          tracking_data: {
            track_status: 1,
            shipment_status: 6,
            shipment_track: [
              {
                id: 1,
                awb_code: awb,
                current_status: currentStatus,
                origin: (track?.origin as string) || "Origin Hub",
                destination: (track?.destination as string) || "Destination",
                date: new Date().toISOString(),
              },
            ],
            shipment_track_activities: [
              {
                date: new Date().toISOString(),
                status: currentStatus,
                activity: `Shipment activity: ${currentStatus}`,
                location: "Mock Hub",
              },
            ],
            track_url: `http://${this.host}:${this.port}/track/${awb}`,
          },
          is_mock: true,
        }),
      );
      return;
    }

    // 8. Cancel Order: POST /v1/external/orders/cancel
    if (pathname === "/v1/external/orders/cancel" && method === "POST") {
      if (this.failCancel) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            message: "Order already out for delivery; cancellation denied.",
            status: 400,
            is_mock: true,
          }),
        );
        return;
      }

      res.writeHead(200);
      res.end(
        JSON.stringify({
          message: "Order cancelled successfully.",
          status: 200,
          is_mock: true,
        }),
      );
      return;
    }

    // 9. Create Reverse Return Order: POST /v1/external/orders/create/return
    if (pathname === "/v1/external/orders/create/return" && method === "POST") {
      if (this.failReturn) {
        res.writeHead(422);
        res.end(
          JSON.stringify({
            message: "Return pickup pincode not serviceable.",
            status_code: 422,
            is_mock: true,
          }),
        );
        return;
      }

      const body = await this.readJsonBody<ShiprocketCreateReturnRequest>(req);
      this.nextOrderId += 1;
      this.nextShipmentId += 1;

      const returnAwb = `SRREV${Date.now()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      this.awbTracking.set(returnAwb, {
        awb_code: returnAwb,
        current_status: "PICKUP SCHEDULED",
        origin: body.pickup_city,
        destination: body.shipping_city,
        courier_name: "Delhivery Reverse (Mock)",
      });

      res.writeHead(200);
      res.end(
        JSON.stringify({
          order_id: this.nextOrderId,
          shipment_id: this.nextShipmentId,
          status: "RETURN_PENDING",
          status_code: 1,
          awb_code: returnAwb,
          courier_company_id: 24,
          courier_name: "Delhivery Reverse (Mock)",
          is_mock: true,
        }),
      );
      return;
    }

    // Fallback: 404 Not Found
    res.writeHead(404);
    res.end(JSON.stringify({ message: "Mock endpoint not found.", endpoint: pathname, is_mock: true }));
  }

  private async readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        try {
          resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
        } catch {
          reject(new Error("Invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  }
}
