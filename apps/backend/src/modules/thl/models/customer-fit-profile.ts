import { model } from "@medusajs/framework/utils";

/**
 * Customer foot measurements and sizing profile (AI-04 Fit Studio Engine).
 * Table: customer_fit_profile (docs/PHASE_5.5_PLAN.md §2.4)
 */
export const CustomerFitProfile = model.define("customer_fit_profile", {
  id: model.id({ prefix: "cfp" }).primaryKey(),
  customer_id: model.text().unique(),
  foot_length_cm: model.number().nullable(),
  foot_width: model.text().default("regular"),
  standard_uk_size: model.number().nullable(),
  notes: model.text().nullable(),
});
