import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface SightSearchBody {
  image_url?: string;
  image_data?: string;
  tags?: string[];
  silhouette_hint?: string;
}

interface ProductMatchRow {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  description: string | null;
  brand_name: string | null;
}

/**
 * POST /store/sight-search
 *
 * Search by Sight (AI-01) — FALLBACK MODE ONLY.
 *
 * D2/D7: this is NOT a real computer-vision search yet. There is no vision model or image
 * embedding here — `image_data`/`image_url` are accepted for forward compatibility but are not
 * analysed; matching is plain keyword/tag/text matching against the catalogue. The storefront
 * must keep this entry point hidden behind `NEXT_PUBLIC_FEATURE_AI_LAYER` until a real vision
 * provider is wired (see docs/MASTER_PLAN.md §2.4) — never present this response as if a photo
 * was actually inspected.
 */
export async function POST(req: MedusaRequest<SightSearchBody>, res: MedusaResponse) {
  const { image_url, image_data, tags = [], silhouette_hint } = req.body ?? {};

  if (!image_url && !image_data && tags.length === 0 && !silhouette_hint) {
    res.status(400).json({
      type: "invalid_data",
      message: "Please provide an image_url, image_data, tags, or a silhouette_hint.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const products = (await pg("product as p")
    .leftJoin("product_brand as pb", "pb.product_id", "p.id")
    .leftJoin("brand as b", "b.id", "pb.brand_id")
    .whereNull("p.deleted_at")
    .andWhere("p.status", "published")
    .select(
      "p.id",
      "p.title",
      "p.handle",
      "p.thumbnail",
      "p.description",
      "b.name as brand_name",
    )) as ProductMatchRow[];

  // Visual perceptual matching logic
  const scoredMatches = products.map((prod) => {
    let score = 0.5; // baseline match score
    const text = `${prod.title} ${prod.description ?? ""} ${prod.brand_name ?? ""}`.toLowerCase();

    if (silhouette_hint && text.includes(silhouette_hint.toLowerCase())) {
      score += 0.4;
    }

    for (const tag of tags) {
      if (text.includes(tag.toLowerCase())) {
        score += 0.15;
      }
    }

    // Heuristics based on image URL hints if available
    const imgStr = (image_url ?? "").toLowerCase();
    if (imgStr.includes("jordan") && prod.handle.includes("jordan")) score += 0.35;
    if (imgStr.includes("samba") && prod.handle.includes("samba")) score += 0.35;
    if (imgStr.includes("dunk") && prod.handle.includes("dunk")) score += 0.35;
    if (imgStr.includes("white") && text.includes("white")) score += 0.1;
    if (imgStr.includes("black") && text.includes("black")) score += 0.1;

    return {
      product: {
        id: prod.id,
        title: prod.title,
        handle: prod.handle,
        thumbnail: prod.thumbnail,
        brand: prod.brand_name ?? "The Hidden Label",
      },
      similarity_score: Math.min(Number(score.toFixed(2)), 0.98),
    };
  });

  scoredMatches.sort((a, b) => b.similarity_score - a.similarity_score);
  const topMatches = scoredMatches.slice(0, 4);

  res.json({
    matches: topMatches,
    detected_features: {
      silhouette: silhouette_hint ?? "Sneaker Low/High Top",
      matched_count: topMatches.length,
      // Honest label — see the route doc comment. Never rename this to imply real image
      // analysis without actually wiring a vision provider first.
      mode: "keyword_tag_matching_fallback",
      image_analysed: false,
    },
  });
}
