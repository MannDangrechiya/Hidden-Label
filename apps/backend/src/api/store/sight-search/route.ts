import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { analyzeSneakerImage, isConfigured as geminiConfigured } from "../../../lib/gemini";

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
 * Search by Sight (AI-01). When `GEMINI_API_KEY` is configured, a supplied `image_url` is
 * actually analysed by Gemini's vision model (see `lib/gemini.ts`) to extract real descriptive
 * keywords, which are then matched against the real catalogue — the model never picks the
 * product itself, it only describes what it sees, so a fabricated product can't appear.
 * `image_data` (a client-uploaded data URI) is not yet wired to a storage/analysis path — only
 * `image_url` is analysed for now. Without a configured key, or if analysis fails, this falls
 * back to the keyword/tag/text matching below, honestly labelled as such in the response
 * (`mode`). The storefront must keep this entry point hidden behind
 * `NEXT_PUBLIC_FEATURE_AI_LAYER` until you're ready to show it (docs/MASTER_PLAN.md §2.4).
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

  let aiKeywords: string[] = [];
  let imageAnalysed = false;
  if (image_url && geminiConfigured()) {
    try {
      aiKeywords = await analyzeSneakerImage(image_url);
      imageAnalysed = true;
    } catch (error) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
      logger.warn(
        `Gemini sight-search analysis failed, falling back to keyword matching: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const allKeywords = [...tags.map((t) => t.toLowerCase()), ...aiKeywords];

  // Matching logic — real AI-derived keywords when imageAnalysed is true, otherwise plain
  // keyword/tag/text matching against user-supplied hints only.
  const scoredMatches = products.map((prod) => {
    let score = 0.5; // baseline match score
    const text = `${prod.title} ${prod.description ?? ""} ${prod.brand_name ?? ""}`.toLowerCase();

    if (silhouette_hint && text.includes(silhouette_hint.toLowerCase())) {
      score += 0.4;
    }

    for (const kw of allKeywords) {
      if (text.includes(kw) || prod.handle.includes(kw.replace(/\s+/g, "-"))) {
        score += imageAnalysed ? 0.2 : 0.15;
      }
    }

    if (!imageAnalysed) {
      // No real image analysis available — fall back to crude keyword hints from the image URL
      // string itself (e.g. a filename containing "jordan"), never claim this is vision.
      const imgStr = (image_url ?? "").toLowerCase();
      if (imgStr.includes("jordan") && prod.handle.includes("jordan")) score += 0.35;
      if (imgStr.includes("samba") && prod.handle.includes("samba")) score += 0.35;
      if (imgStr.includes("dunk") && prod.handle.includes("dunk")) score += 0.35;
      if (imgStr.includes("white") && text.includes("white")) score += 0.1;
      if (imgStr.includes("black") && text.includes("black")) score += 0.1;
    }

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
      silhouette: silhouette_hint ?? aiKeywords[0] ?? "Sneaker Low/High Top",
      matched_count: topMatches.length,
      // Honest label — see the route doc comment. Never rename this to imply real image
      // analysis unless `image_analysed` is actually true.
      mode: imageAnalysed ? "gemini_vision_analysis" : "keyword_tag_matching_fallback",
      image_analysed: imageAnalysed,
      ...(imageAnalysed ? { ai_detected_keywords: aiKeywords } : {}),
    },
  });
}
