import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { actorId } from "../../../../lib/auth";

interface BookingBody {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  scheduled_at?: string;
  service_type?: "bespoke_fitting" | "styling" | "wardrobe_curation";
  notes?: string;
}

/**
 * POST /store/bespoke/consultations — Book an in-person atelier consultation appointment (Phase 7).
 */
export async function POST(req: MedusaRequest<BookingBody>, res: MedusaResponse) {
  const body = req.body ?? {};
  const name = body.customer_name?.trim();
  const email = body.customer_email?.trim();
  const phone = body.customer_phone?.trim();
  const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : null;

  if (!name || !email || !phone) {
    res.status(400).json({
      type: "invalid_data",
      message: "Customer name, email, and phone number are required.",
    });
    return;
  }

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
    res.status(400).json({
      type: "invalid_data",
      message: "A valid future appointment date and time is required.",
    });
    return;
  }

  const customerId = actorId(req) ?? null;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const bookingId = `cbk_${randomBytes(8).toString("hex")}`;
  const now = new Date();

  const [booking] = await pg("consultation_booking")
    .insert({
      id: bookingId,
      customer_id: customerId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      scheduled_at: scheduledAt,
      service_type: body.service_type ?? "bespoke_fitting",
      status: "scheduled",
      notes: body.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .returning("*");

  res.status(201).json({
    booking,
    message: "Atelier appointment booked successfully. Our concierge will confirm your slot.",
  });
}
