import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { isEmail, normalizeIndianPhone } from "../../../../lib/phone";

interface Body {
  name?: string;
  email?: string;
  phone?: string;
  order_id?: string;
  category?: string;
  subject?: string;
  message?: string;
}

const CATEGORIES = ["general", "order", "return", "product", "payment", "privacy", "grievance"];
const MAX_MESSAGE = 5_000;

/**
 * POST /store/support/tickets — GAP-SUP-01.
 *
 * A recorded support request instead of a static FAQ. Every submission gets a human-readable
 * ticket id the customer can quote to the Grievance Officer, and operations sees it in the
 * admin console.
 */
export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const body = req.body ?? {};
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const subject = (body.subject ?? "").trim();
  const message = (body.message ?? "").trim();
  const category = CATEGORIES.includes(body.category ?? "") ? (body.category as string) : "general";
  const phone = body.phone ? normalizeIndianPhone(body.phone) : null;

  if (!name || !isEmail(email) || !subject || !message) {
    res.status(400).json({
      type: "invalid_data",
      message: "Your name, a valid email, a subject and a message are required.",
    });
    return;
  }

  if (message.length > MAX_MESSAGE) {
    res.status(400).json({
      type: "invalid_data",
      message: `Please keep the message under ${MAX_MESSAGE} characters.`,
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  // Attach the signed-in customer when the storefront sent a token; the form also works for
  // guests, which is what the Consumer Protection Rules require.
  const authContext = (req as unknown as {
    auth_context?: { actor_id?: string; actor_type?: string };
  }).auth_context;
  const customerId = authContext?.actor_type === "customer" ? authContext.actor_id ?? null : null;

  const displayId = `TKT-${Date.now().toString(36).toUpperCase()}`;

  const [ticket] = await pg("support_ticket")
    .insert({
      id: generateEntityId(undefined, "tkt"),
      display_id: displayId,
      customer_id: customerId,
      name,
      email,
      phone,
      order_id: body.order_id?.trim() || null,
      category,
      subject,
      message,
      status: "open",
      priority: category === "grievance" ? "high" : "normal",
    })
    .returning(["display_id", "status"]);

  logger.info(`support ticket ${displayId} created (${category})`);

  res.status(201).json({
    ticket,
    acknowledgement:
      "We acknowledge your request within 48 hours and resolve it within 30 days, per the Consumer Protection (E-Commerce) Rules, 2020.",
  });
}
