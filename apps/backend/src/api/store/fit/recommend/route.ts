import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface FitRecommendBody {
  foot_length_cm?: number;
  baseline_uk_size?: number;
  foot_width?: "narrow" | "regular" | "wide";
  silhouette_name?: string;
  product_handle?: string;
  product_id?: string;
}

interface FitRuleRow {
  id: string;
  silhouette_name: string;
  fit_tendency: string;
  recommended_size_delta: number | string;
  width_profile: string;
  guidance_text: string;
}

// Foot length CM to standard UK sizing lookup table
function cmToUkSize(cm: number): number {
  if (cm <= 24.0) return 5.0;
  if (cm <= 24.5) return 5.5;
  if (cm <= 25.0) return 6.0;
  if (cm <= 25.5) return 6.5;
  if (cm <= 26.0) return 7.0;
  if (cm <= 26.5) return 7.5;
  if (cm <= 27.0) return 8.0;
  if (cm <= 27.5) return 8.5;
  if (cm <= 28.0) return 9.0;
  if (cm <= 28.5) return 9.5;
  if (cm <= 29.0) return 10.0;
  if (cm <= 29.5) return 10.5;
  if (cm <= 30.0) return 11.0;
  return 11.5;
}

/**
 * POST /store/fit/recommend
 *
 * Sizing recommendation engine (AI-04 Fit Studio Engine).
 * Converts metric foot length and silhouette specifics into an optimal UK size.
 */
export async function POST(req: MedusaRequest<FitRecommendBody>, res: MedusaResponse) {
  const { foot_length_cm, baseline_uk_size, foot_width = "regular", silhouette_name, product_handle, product_id } =
    req.body ?? {};

  let baseline = 8.0;
  if (typeof foot_length_cm === "number" && foot_length_cm > 15 && foot_length_cm < 40) {
    baseline = cmToUkSize(foot_length_cm);
  } else if (typeof baseline_uk_size === "number" && baseline_uk_size >= 3 && baseline_uk_size <= 16) {
    baseline = baseline_uk_size;
  } else {
    res.status(400).json({
      type: "invalid_data",
      message: "Either valid foot_length_cm (e.g. 26.5) or baseline_uk_size (e.g. 8.0) is required.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Determine silhouette name
  let targetSilhouette = silhouette_name ?? "";
  if (!targetSilhouette && (product_handle || product_id)) {
    const q = pg("product").select("title");
    if (product_handle) q.where({ handle: product_handle });
    else if (product_id) q.where({ id: product_id });
    const prod = await q.first();
    if (prod?.title) {
      targetSilhouette = prod.title;
    }
  }

  // Find matching fit rule
  const rules = (await pg("silhouette_fit_rule").select("*")) as FitRuleRow[];
  const matchedRule = rules.find((r) =>
    targetSilhouette.toLowerCase().includes(r.silhouette_name.toLowerCase()),
  );

  let delta = 0;
  let tendency = "true_to_size";
  let guidance = "Standard sneaker fit applies. Order your typical UK size.";

  if (matchedRule) {
    delta += Number(matchedRule.recommended_size_delta);
    tendency = matchedRule.fit_tendency;
    guidance = matchedRule.guidance_text;

    // Apply foot width adjustments
    if (foot_width === "wide" && matchedRule.width_profile === "narrow") {
      delta += 0.5;
      guidance += " Because you selected a wide foot profile, we added an extra half size for toe-box comfort.";
    } else if (foot_width === "narrow" && matchedRule.width_profile === "wide") {
      delta -= 0.5;
    }
  } else if (foot_width === "wide") {
    delta += 0.5;
    guidance = "For wide feet in standard silhouettes, half a size up is recommended.";
  }

  const recommendedSize = Math.round((baseline + delta) * 2) / 2;
  const formattedSize = `UK ${recommendedSize.toFixed(1)}`;

  res.json({
    recommended_size: formattedSize,
    recommended_size_number: recommendedSize,
    baseline_uk_size: baseline,
    total_delta: delta,
    fit_tendency: tendency,
    width_applied: foot_width,
    guidance,
    confidence_score: matchedRule ? 0.94 : 0.82,
    matched_silhouette: matchedRule?.silhouette_name ?? "Standard Sneaker",
  });
}
