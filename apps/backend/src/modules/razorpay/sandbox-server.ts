import http from "node:http";
import crypto from "node:crypto";

export interface SandboxOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
  created_at: number;
}

export interface SandboxPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "authorized" | "captured" | "failed";
  method?: string;
  notes?: Record<string, string>;
  error_code?: string;
  error_description?: string;
  created_at: number;
}

export interface SandboxRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  created_at: number;
}

/**
 * Embedded Razorpay API Sandbox Server for automated testing and local purchase verification.
 * Strictly emulates Razorpay's v1 REST API contract with exact HMAC signatures.
 */
export class RazorpaySandboxServer {
  private server?: http.Server;
  private port?: number;

  public orders = new Map<string, SandboxOrder>();
  public payments = new Map<string, SandboxPayment>();
  public refunds = new Map<string, SandboxRefund>();

  constructor(public readonly keySecret: string, public readonly webhookSecret: string) {}

  async start(port = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          await this.handleRequest(req, res);
        } catch (err) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { message: (err as Error).message } }));
        }
      });

      this.server.listen(port, "127.0.0.1", () => {
        const address = this.server?.address();
        if (address && typeof address === "object") {
          this.port = address.port;
          resolve(this.port);
        } else {
          reject(new Error("Could not determine server address"));
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getUrl(): string {
    if (!this.port) throw new Error("Sandbox server not started");
    return `http://127.0.0.1:${this.port}/v1`;
  }

  private async parseJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";
    const path = url.pathname.replace(/^\/v1/, "");

    // 1. POST /orders
    if (method === "POST" && path === "/orders") {
      const data = await this.parseJsonBody(req);
      const id = `order_test_${crypto.randomBytes(8).toString("hex")}`;
      const order: SandboxOrder = {
        id,
        amount: Number(data.amount ?? 0),
        currency: String(data.currency ?? "INR").toUpperCase(),
        status: "created",
        notes: (data.notes as Record<string, string>) ?? {},
        created_at: Math.floor(Date.now() / 1000),
      };
      this.orders.set(id, order);

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(order));
      return;
    }

    // 2. GET /payments/:id
    const paymentMatch = path.match(/^\/payments\/([^/]+)$/);
    if (method === "GET" && paymentMatch) {
      const paymentId = paymentMatch[1];
      const payment = this.payments.get(paymentId);
      if (!payment) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payment));
      return;
    }

    // 3. POST /payments/:id/capture
    const captureMatch = path.match(/^\/payments\/([^/]+)\/capture$/);
    if (method === "POST" && captureMatch) {
      const paymentId = captureMatch[1];
      const data = await this.parseJsonBody(req);
      const payment = this.payments.get(paymentId);
      if (!payment) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }));
        return;
      }

      if (payment.status === "captured") {
        // Razorpay responds with 400 when attempting to capture already-captured payment
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: { code: "BAD_REQUEST_ERROR", description: "This payment has already been captured" },
          }),
        );
        return;
      }

      payment.status = "captured";
      if (data.amount) payment.amount = Number(data.amount);

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(payment));
      return;
    }

    // 4. POST /payments/:id/refund
    const refundMatch = path.match(/^\/payments\/([^/]+)\/refund$/);
    if (method === "POST" && refundMatch) {
      const paymentId = refundMatch[1];
      const data = await this.parseJsonBody(req);
      const payment = this.payments.get(paymentId);
      if (!payment) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR", description: "Payment not found" } }));
        return;
      }

      const id = `rfn_test_${crypto.randomBytes(8).toString("hex")}`;
      const refund: SandboxRefund = {
        id,
        payment_id: paymentId,
        amount: Number(data.amount ?? payment.amount),
        status: "processed",
        created_at: Math.floor(Date.now() / 1000),
      };
      this.refunds.set(id, refund);

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(refund));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: `Route not found: ${method} ${path}` } }));
  }

  /**
   * Simulates customer paying an order in the Razorpay sandbox modal.
   * Returns razorpay_payment_id and the valid HMAC-SHA256 signature.
   */
  simulateSuccessfulPayment(
    orderId: string,
    amountPaise?: number,
  ): { paymentId: string; orderId: string; signature: string } {
    const order = this.orders.get(orderId);
    const amount = amountPaise ?? (order?.amount ?? 100000);
    const paymentId = `pay_test_${crypto.randomBytes(8).toString("hex")}`;

    this.payments.set(paymentId, {
      id: paymentId,
      order_id: orderId,
      amount,
      currency: order?.currency ?? "INR",
      status: "authorized",
      notes: order?.notes,
      created_at: Math.floor(Date.now() / 1000),
    });

    const signature = crypto
      .createHmac("sha256", this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    return { paymentId, orderId, signature };
  }

  /**
   * Generates a signed webhook payload from Razorpay for testing webhook endpoints.
   */
  generateWebhookDelivery(
    eventType: "payment.captured" | "payment.authorized" | "payment.failed",
    paymentId: string,
    orderId: string,
    amountPaise: number,
    notes?: Record<string, string>,
  ): { rawBody: Buffer; body: Record<string, unknown>; signature: string; eventId: string } {
    const eventId = `evt_test_${crypto.randomBytes(8).toString("hex")}`;
    const payload = {
      id: eventId,
      entity: "event",
      event: eventType,
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: amountPaise,
            currency: "INR",
            status: eventType === "payment.captured" ? "captured" : eventType === "payment.authorized" ? "authorized" : "failed",
            notes: notes ?? {},
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    return { rawBody, body: payload, signature, eventId };
  }
}
