"use server";

import type { ActionResult } from "@/app/actions/auth";
import { readAuthToken } from "@/lib/auth-cookie";
import { createSupportTicket, MedusaError } from "@/lib/medusa";

export interface SupportResult extends ActionResult {
  ticketId?: string;
}

/**
 * GAP-SUP-01: records a real support/grievance ticket. Works for signed-in customers and
 * guests; the backend stores the customer id only when a valid token is supplied.
 */
export async function submitSupportTicketAction(formData: FormData): Promise<SupportResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const category = String(formData.get("category") ?? "general");
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !subject || !message) {
    return { ok: false, message: "Name, email, subject and message are required." };
  }

  try {
    const token = await readAuthToken();
    const result = await createSupportTicket(
      {
        name,
        email,
        ...(phone ? { phone } : {}),
        ...(orderId ? { order_id: orderId } : {}),
        category,
        subject,
        message,
      },
      token ?? undefined,
    );

    return {
      ok: true,
      ticketId: result.ticket.display_id,
      message: `Your request ${result.ticket.display_id} is recorded. We acknowledge it within 48 hours and resolve it within 30 days.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof MedusaError
          ? error.message
          : "Could not submit your request. Please email the Grievance Officer instead.",
    };
  }
}
