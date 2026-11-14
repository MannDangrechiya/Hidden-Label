import { model } from "@medusajs/framework/utils";

/**
 * Silhouette fit rules (AI-04 Fit Studio Engine).
 * Table: silhouette_fit_rule (docs/PHASE_5.5_PLAN.md §2.4)
 */
export const SilhouetteFitRule = model.define("silhouette_fit_rule", {
  id: model.id({ prefix: "fit" }).primaryKey(),
  brand_id: model.text().nullable(),
  silhouette_name: model.text(),
  fit_tendency: model.text().default("true_to_size"),
  recommended_size_delta: model.number().default(0),
  width_profile: model.text().default("regular"),
  guidance_text: model.text(),
});
