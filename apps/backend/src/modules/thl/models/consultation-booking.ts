import { model } from "@medusajs/framework/utils";

/**
 * ConsultationBooking: In-person styling and bespoke atelier appointment bookings (Phase 7).
 * Table: consultation_booking
 */
export const ConsultationBooking = model.define("consultation_booking", {
  id: model.id({ prefix: "cbk" }).primaryKey(),
  customer_id: model.text().nullable(),
  customer_name: model.text(),
  customer_email: model.text(),
  customer_phone: model.text(),
  scheduled_at: model.dateTime(),
  service_type: model.text().default("bespoke_fitting"),
  status: model.text().default("scheduled"),
  notes: model.text().nullable(),
});
