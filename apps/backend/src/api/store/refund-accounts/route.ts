import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";

interface Body {
  order_id?: string;
  return_request_id?: string;
  method?: "upi" | "bank";
  upi_id?: string;
  account_name?: string;
  account_number?: string;
  ifsc?: string;
  bank_name?: string;
}

/**
 * POST /store/refund-accounts — GAP-PAY-04.
 *
 * Cash-on-Delivery orders have no instrument to refund to. The customer supplies a UPI VPA or
 * bank account, which operations reads from the return before releasing a manual payout.
 * Ownership is taken from the authenticated actor, never from the request body.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const authContext = (req as unknown as {
    auth_context?: { actor_id?: string; actor_type?: string };
  }).auth_context;
  const customerId = authContext?.actor_id;

  if (authContext?.actor_type !== "customer" || !customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to add refund details." });
    return;
  }

  const body = req.body ?? {};
  const orderId = body.order_id?.trim();
  const method = body.method;

  if (!orderId || (method !== "upi" && method !== "bank")) {
    res.status(400).json({ type: "invalid_data", message: "An order and a refund method are required." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const order = await pg("order")
    .where({ id: orderId, customer_id: customerId })
    .whereNull("deleted_at")
    .first("id");
  if (!order) {
    res.status(404).json({ type: "not_found", message: "Order not found." });
    return;
  }

  let payload: Record<string, unknown>;
  if (method === "upi") {
    const upi = body.upi_id?.trim() ?? "";
    if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
      res.status(400).json({ type: "invalid_data", message: "Enter a valid UPI ID (name@bank)." });
      return;
    }
    payload = { upi_id: upi };
  } else {
    const accountName = body.account_name?.trim() ?? "";
    const accountNumber = (body.account_number ?? "").replace(/\s/g, "");
    const ifsc = (body.ifsc ?? "").trim().toUpperCase();
    if (!accountName || !/^\d{9,18}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      res.status(400).json({
        type: "invalid_data",
        message: "Enter the account holder name, a valid account number and an IFSC code.",
      });
      return;
    }
    payload = {
      account_name: accountName,
      account_number: accountNumber,
      ifsc,
      bank_name: body.bank_name?.trim() ?? null,
    };
  }

  const [row] = await pg("refund_account")
    .insert({
      id: generateEntityId(undefined, "rfa"),
      customer_id: customerId,
      order_id: orderId,
      return_request_id: body.return_request_id?.trim() || null,
      method,
      ...payload,
    })
    .returning(["id", "method", "created_at"]);

  res.status(201).json({
    refund_account: row,
    message: "Refund details saved. Manual payouts are released within 5–7 working days of the return being received.",
  });
}
