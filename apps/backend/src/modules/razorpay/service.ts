import type { Logger } from "@medusajs/framework/types";
import { AbstractPaymentProvider, MedusaError, PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";
import crypto from "node:crypto";
import { toPaise } from "../../lib/money";

export interface RazorpayOptions {
  key_id?: string;
  key_secret?: string;
  webhook_secret?: string;
  api_url?: string;
}

interface InjectedDependencies extends Record<string, unknown> {
  logger: Logger;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Razorpay Payment Provider for The Hidden Label.
 *
 * Handles the complete prepaid payment lifecycle:
 *  1. initiatePayment -> creates a Razorpay order with server-calculated amount in paise
 *     and binds the Medusa session_id into order notes.
 *  2. authorizePayment -> validates the HMAC-SHA256 signature in constant time AND queries
 *     the Razorpay API server-side to confirm the amount and order_id match, preventing
 *     client-side amount manipulation attacks.
 *  3. capturePayment -> captures the authorized payment idempotently (gracefully handling
 *     already-captured payments without failing).
 *  4. getWebhookActionAndData -> constant-time signature verification for webhooks,
 *     mapping payment.captured, payment.authorized, and payment.failed.
 */
export default class RazorpayPaymentProviderService extends AbstractPaymentProvider<RazorpayOptions> {
  static identifier = "razorpay";

  protected readonly logger: Logger;
  protected readonly options: RazorpayOptions;

  constructor(container: InjectedDependencies, options: RazorpayOptions) {
    super(container, options);
    this.logger = container.logger;
    this.options = options;
  }

  static validateOptions(options: Record<string, unknown>): void {
    void options;
  }

  private isConfigured(): boolean {
    return Boolean(this.options.key_id && this.options.key_secret);
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.options.key_id}:${this.options.key_secret}`).toString("base64");
    return `Basic ${token}`;
  }

  private getBaseUrl(): string {
    return this.options.api_url || process.env.RAZORPAY_API_URL || "https://api.razorpay.com/v1";
  }

  private async razorpayFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    if (!this.isConfigured()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to use this payment method.",
      );
    }

    const baseUrl = this.getBaseUrl();
    const response = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: this.authHeader(),
        "content-type": "application/json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    const text = await response.text();
    if (!response.ok) {
      this.logger.error(`razorpay ${path} failed: ${response.status} ${text.slice(0, 300)}`);
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Razorpay request failed (${response.status}): ${text.slice(0, 200)}`,
      );
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  private parseAmountToPaise(inputAmount: unknown): number {
    if (typeof inputAmount === "object" && inputAmount !== null && "value" in inputAmount) {
      return toPaise((inputAmount as { value: string | number }).value);
    }
    return toPaise((inputAmount as string | number) ?? 0);
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const amount = this.parseAmountToPaise(input.amount);
    const sessionId =
      (input.data?.session_id as string | undefined) ?? input.context?.idempotency_key ?? "";

    const order = await this.razorpayFetch<RazorpayOrder>("/orders", {
      method: "POST",
      body: {
        amount,
        currency: input.currency_code.toUpperCase(),
        payment_capture: 0,
        notes: {
          customer_email: input.context?.customer?.email ?? "",
          session_id: sessionId,
        },
      },
    });

    return {
      id: order.id,
      status: PaymentSessionStatus.PENDING,
      data: {
        razorpay_order_id: order.id,
        amount,
        currency_code: input.currency_code,
        session_id: sessionId,
      },
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = input.data ?? {};
    const client = (data.client as Record<string, unknown> | undefined) ?? {};
    const orderId = (client.razorpay_order_id ?? data.razorpay_order_id) as string | undefined;
    const paymentId = (client.razorpay_payment_id ?? data.razorpay_payment_id) as string | undefined;
    const signature = (client.razorpay_signature ?? data.razorpay_signature) as string | undefined;

    if (!orderId || !paymentId || !signature) {
      // Checkout has not completed in browser yet: keep pending for customer retry
      return { status: PaymentSessionStatus.PENDING, data };
    }

    if (!this.options.key_secret) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Razorpay is not configured.");
    }

    // 1. Constant-time checkout signature verification
    const expected = crypto
      .createHmac("sha256", this.options.key_secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      this.logger.warn(`razorpay signature mismatch for order ${orderId}`);
      return { status: PaymentSessionStatus.ERROR, data };
    }

    // 2. Server-side validation against Razorpay API to prevent amount tampering
    try {
      const payment = await this.razorpayFetch<{
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
      }>(`/payments/${paymentId}`);

      const expectedAmount =
        data.amount !== undefined
          ? Number(data.amount)
          : this.parseAmountToPaise((input as unknown as { amount?: unknown }).amount);

      if (payment.amount !== expectedAmount) {
        this.logger.error(
          `razorpay payment amount manipulation detected for ${paymentId}: expected ${expectedAmount}, got ${payment.amount}`,
        );
        return { status: PaymentSessionStatus.ERROR, data: { ...data, error: "amount_mismatch" } };
      }

      if (payment.order_id !== orderId) {
        this.logger.error(
          `razorpay order mismatch for payment ${paymentId}: expected ${orderId}, got ${payment.order_id}`,
        );
        return { status: PaymentSessionStatus.ERROR, data: { ...data, error: "order_mismatch" } };
      }

      if (payment.status !== "authorized" && payment.status !== "captured") {
        this.logger.error(`razorpay payment ${paymentId} has invalid status: ${payment.status}`);
        return { status: PaymentSessionStatus.ERROR, data: { ...data, error: "invalid_status" } };
      }

      return {
        status: PaymentSessionStatus.AUTHORIZED,
        data: {
          ...data,
          verified_at: new Date().toISOString(),
          verified_amount: payment.amount,
        },
      };
    } catch (error) {
      this.logger.error(
        `razorpay payment lookup failed during authorization: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { status: PaymentSessionStatus.ERROR, data };
    }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = input.data ?? {};
    const client = (data.client as Record<string, unknown> | undefined) ?? {};
    const paymentId = (client.razorpay_payment_id ?? data.razorpay_payment_id) as string | undefined;
    if (!paymentId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing Razorpay payment id to capture.");
    }
    const amount =
      data.amount !== undefined
        ? Number(data.amount)
        : this.parseAmountToPaise((input as unknown as { amount?: unknown }).amount);

    // First check if already captured to ensure idempotency
    try {
      const existing = await this.retrievePayment(input);
      const status = (existing.data as { status?: string })?.status;
      if (status === "captured") {
        return { data: { ...data, captured: existing.data } };
      }

      const captured = await this.razorpayFetch<Record<string, unknown>>(`/payments/${paymentId}/capture`, {
        method: "POST",
        body: { amount, currency: (data.currency_code as string | undefined)?.toUpperCase() ?? "INR" },
      });
      return { data: { ...data, captured } };
    } catch (error) {
      // If Razorpay returns that the payment is already captured, treat idempotently as success
      if (
        (error instanceof MedusaError && error.message.includes("already been captured")) ||
        (error instanceof Error && error.message.includes("already been captured"))
      ) {
        const existing = await this.retrievePayment(input);
        return { data: { ...data, captured: existing.data } };
      }
      throw error;
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data ?? {} };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const data = input.data ?? {};
    const paymentId = data.razorpay_payment_id as string | undefined;
    if (!paymentId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing Razorpay payment id to refund.");
    }
    const refund = await this.razorpayFetch<Record<string, unknown>>(`/payments/${paymentId}/refund`, {
      method: "POST",
      body: { amount: Math.round(Number(input.amount)) },
    });
    return { data: { ...data, last_refund: refund } };
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const paymentId = (input.data ?? {}).razorpay_payment_id as string | undefined;
    if (!paymentId) return { data: input.data ?? {} };
    const payment = await this.razorpayFetch<Record<string, unknown>>(`/payments/${paymentId}`);
    return { data: payment };
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const paymentId = (input.data ?? {}).razorpay_payment_id as string | undefined;
    if (!paymentId) return { status: PaymentSessionStatus.PENDING };

    const payment = await this.razorpayFetch<{ status: string }>(`/payments/${paymentId}`);
    switch (payment.status) {
      case "captured":
        return { status: PaymentSessionStatus.CAPTURED };
      case "authorized":
        return { status: PaymentSessionStatus.AUTHORIZED };
      case "failed":
        return { status: PaymentSessionStatus.ERROR };
      default:
        return { status: PaymentSessionStatus.PENDING };
    }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const webhookSecret = this.options.webhook_secret;
    const rawData = payload.rawData;
    const signature = (payload.headers as Record<string, string> | undefined)?.["x-razorpay-signature"];

    if (!webhookSecret || !signature || !rawData) {
      this.logger.warn("razorpay webhook received without a verifiable signature; ignoring");
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawData as Buffer)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      this.logger.warn("razorpay webhook signature mismatch; ignoring");
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const body = payload.data as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            notes?: Record<string, string>;
          };
        };
      };
    };
    const entity = body.payload?.payment?.entity;
    const sessionId = entity?.notes?.session_id ?? entity?.order_id ?? "";
    const amount = entity?.amount ?? 0;

    switch (body.event) {
      case "payment.captured":
        return { action: PaymentActions.SUCCESSFUL, data: { session_id: sessionId, amount } };
      case "payment.authorized":
        return { action: PaymentActions.AUTHORIZED, data: { session_id: sessionId, amount } };
      case "payment.failed":
        return { action: PaymentActions.FAILED, data: { session_id: sessionId, amount } };
      default:
        return { action: PaymentActions.NOT_SUPPORTED };
    }
  }
}
