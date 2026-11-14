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

export interface RazorpayOptions {
  key_id?: string;
  key_secret?: string;
  webhook_secret?: string;
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
 * Scaffold for Razorpay, gated entirely by env vars (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
 * `RAZORPAY_WEBHOOK_SECRET` — see .env.example). It is registered in medusa-config.ts so the
 * code path exists and typechecks, but is only added to a region's `payment_providers` once
 * real test/live keys are supplied — see docs/BUILD_LOG.md for the exact activation steps.
 *
 * Every method that talks to Razorpay fails loudly (`MedusaError`, never a silent mock) when
 * keys are missing, so a half-configured environment cannot pretend to take a payment.
 *
 * Flow implemented here mirrors Razorpay's own "Orders API" checkout:
 *  1. initiatePayment -> creates a Razorpay order for the cart's total (paise, already the
 *     unit Medusa uses — no conversion needed).
 *  2. The storefront's Razorpay Checkout widget collects the payment and returns
 *     razorpay_order_id / razorpay_payment_id / razorpay_signature.
 *  3. authorizePayment -> verifies the HMAC-SHA256 checkout signature server-side
 *     (`order_id|payment_id` signed with the key secret) before trusting the browser.
 *  4. getWebhookActionAndData -> verifies the webhook's HMAC-SHA256 signature (raw body signed
 *     with the webhook secret) so `payment.captured` / `payment.failed` events from Razorpay's
 *     servers update the order even if the customer's browser never returns.
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
    // Intentionally permissive: the module loads even without keys (so the app boots without
    // Razorpay configured) and every runtime method below checks `isConfigured()` itself.
    void options;
  }

  private isConfigured(): boolean {
    return Boolean(this.options.key_id && this.options.key_secret);
  }

  private authHeader(): string {
    const token = Buffer.from(`${this.options.key_id}:${this.options.key_secret}`).toString("base64");
    return `Basic ${token}`;
  }

  private async razorpayFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    if (!this.isConfigured()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to use this payment method.",
      );
    }

    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
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
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Razorpay request failed (${response.status}).`);
    }
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const amount = Math.round(Number(input.amount));
    const order = await this.razorpayFetch<RazorpayOrder>("/orders", {
      method: "POST",
      body: {
        amount,
        currency: input.currency_code.toUpperCase(),
        payment_capture: 0,
        notes: { customer_email: input.context?.customer?.email ?? "" },
      },
    });

    return {
      id: order.id,
      status: PaymentSessionStatus.PENDING,
      data: { razorpay_order_id: order.id, amount, currency_code: input.currency_code },
    };
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = input.data ?? {};
    const orderId = data.razorpay_order_id as string | undefined;
    const paymentId = data.razorpay_payment_id as string | undefined;
    const signature = data.razorpay_signature as string | undefined;

    if (!orderId || !paymentId || !signature) {
      // Checkout has not completed in the browser yet — the cart-complete workflow treats
      // this as "not authorized" rather than throwing, so the customer can retry payment.
      return { status: PaymentSessionStatus.PENDING, data };
    }

    if (!this.options.key_secret) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Razorpay is not configured.");
    }

    const expected = crypto
      .createHmac("sha256", this.options.key_secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expected !== signature) {
      this.logger.warn(`razorpay signature mismatch for order ${orderId}`);
      return { status: PaymentSessionStatus.ERROR, data };
    }

    return { status: PaymentSessionStatus.AUTHORIZED, data: { ...data, verified_at: new Date().toISOString() } };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const data = input.data ?? {};
    const paymentId = data.razorpay_payment_id as string | undefined;
    if (!paymentId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing Razorpay payment id to capture.");
    }
    const amount = data.amount as number | undefined;
    const captured = await this.razorpayFetch<Record<string, unknown>>(`/payments/${paymentId}/capture`, {
      method: "POST",
      body: { amount, currency: (data.currency_code as string | undefined)?.toUpperCase() ?? "INR" },
    });
    return { data: { ...data, captured } };
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Razorpay has no "void"; an uncaptured authorization simply expires. Nothing to call.
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

  /**
   * Verifies the raw-body HMAC-SHA256 signature Razorpay sends on every webhook request
   * (`X-Razorpay-Signature` header) against `RAZORPAY_WEBHOOK_SECRET`, per Razorpay's webhook
   * documentation. Reachable once registered at `/hooks/payment/razorpay_razorpay`
   * (see docs/BUILD_LOG.md for why the path repeats the identifier).
   */
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

    if (expected !== signature) {
      this.logger.warn("razorpay webhook signature mismatch; ignoring");
      return { action: PaymentActions.NOT_SUPPORTED };
    }

    const body = payload.data as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; notes?: Record<string, string> } } };
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
