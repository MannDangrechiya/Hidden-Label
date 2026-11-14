import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface ProductRow {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  description: string | null;
}

interface VariantRow {
  id: string;
  title: string;
  sku: string | null;
}

interface PriceHistoryRow {
  id: string;
  price_rupees: string | number;
  condition_grade: string;
  source: string;
  recorded_at: string;
}

interface AskRow {
  id: string;
  ask_price: string | number;
  condition_grade: string;
  box_condition: string;
}

interface BidRow {
  id: string;
  bid_price: string | number;
}

interface InspectionRow {
  id: string;
  unit_serial: string;
  status: string;
  condition_grade: string;
  box_condition: string;
  inspected_at: string | null;
}

interface FitRuleRow {
  id: string;
  silhouette_name: string;
  fit_tendency: string;
  recommended_size_delta: number;
  width_profile: string;
  guidance_text: string;
}

/**
 * GET /store/resale/products/:handle/index
 *
 * Secondary market pricing, size-variant orderbook depth, historical trades (AI-02 The Price Index),
 * and verified inspection summary (AI-03).
 */
export async function GET(
  req: MedusaRequest & { params: { handle: string } },
  res: MedusaResponse,
) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const handle = req.params.handle;

  const product = (await pg("product")
    .where({ handle })
    .whereNull("deleted_at")
    .select("id", "title", "handle", "thumbnail", "description")
    .first()) as ProductRow | undefined;

  if (!product) {
    res.status(404).json({ type: "not_found", message: `Product '${handle}' not found.` });
    return;
  }

  const variants = (await pg("product_variant")
    .where({ product_id: product.id })
    .whereNull("deleted_at")
    .orderBy("id", "asc")
    .select("id", "title", "sku")) as VariantRow[];

  // Find matching silhouette fit rule for the product
  const fitRules = (await pg("silhouette_fit_rule").select("*")) as FitRuleRow[];
  const matchedRule = fitRules.find((r) =>
    product.title.toLowerCase().includes(r.silhouette_name.toLowerCase()),
  );

  const variantData = await Promise.all(
    variants.map(async (v) => {
      // 1. Lowest ask
      const lowestAsk = (await pg("resale_ask")
        .where({ variant_id: v.id, status: "active" })
        .whereNull("deleted_at")
        .orderBy("ask_price", "asc")
        .select("id", "ask_price", "condition_grade", "box_condition")
        .first()) as AskRow | undefined;

      // 2. Highest bid
      const highestBid = (await pg("resale_bid")
        .where({ variant_id: v.id, status: "active" })
        .whereNull("deleted_at")
        .orderBy("bid_price", "desc")
        .select("id", "bid_price")
        .first()) as BidRow | undefined;

      // 3. Counts
      const askCountRes = await pg("resale_ask")
        .where({ variant_id: v.id, status: "active" })
        .whereNull("deleted_at")
        .count("id as count")
        .first();
      const bidCountRes = await pg("resale_bid")
        .where({ variant_id: v.id, status: "active" })
        .whereNull("deleted_at")
        .count("id as count")
        .first();

      // 4. Historical price index points (AI-02)
      const historyPoints = (await pg("price_history_point")
        .where({ variant_id: v.id })
        .whereNull("deleted_at")
        .orderBy("recorded_at", "asc")
        .select("id", "price_rupees", "condition_grade", "source", "recorded_at")) as PriceHistoryRow[];

      const prices = historyPoints.map((p) => Number(p.price_rupees));
      const latestPoint = historyPoints[historyPoints.length - 1];
      const oldestPoint = historyPoints[0];

      let changePct30d = 0;
      if (latestPoint && oldestPoint && Number(oldestPoint.price_rupees) > 0) {
        changePct30d = Number(
          (
            ((Number(latestPoint.price_rupees) - Number(oldestPoint.price_rupees)) /
              Number(oldestPoint.price_rupees)) *
            100
          ).toFixed(1),
        );
      }

      // 5. Approved inspection summary (AI-03)
      const inspection = (await pg("condition_inspection")
        .where({ variant_id: v.id, status: "approved" })
        .whereNull("deleted_at")
        .select("id", "unit_serial", "status", "condition_grade", "box_condition", "inspected_at")
        .first()) as InspectionRow | undefined;

      return {
        variant_id: v.id,
        size: v.title,
        sku: v.sku,
        lowest_ask: lowestAsk ? Number(lowestAsk.ask_price) : null,
        highest_bid: highestBid ? Number(highestBid.bid_price) : null,
        active_asks_count: Number(askCountRes?.count ?? 0),
        active_bids_count: Number(bidCountRes?.count ?? 0),
        last_sale_price: latestPoint ? Number(latestPoint.price_rupees) : lowestAsk ? Number(lowestAsk.ask_price) : null,
        change_pct_30d: changePct30d,
        high_52w: prices.length > 0 ? Math.max(...prices) : null,
        low_52w: prices.length > 0 ? Math.min(...prices) : null,
        price_history: historyPoints.map((p) => ({
          recorded_at: p.recorded_at,
          price_rupees: Number(p.price_rupees),
          condition_grade: p.condition_grade,
          source: p.source,
        })),
        inspection_summary: inspection
          ? {
              unit_serial: inspection.unit_serial,
              condition_grade: inspection.condition_grade,
              box_condition: inspection.box_condition,
              inspected_at: inspection.inspected_at,
            }
          : null,
      };
    }),
  );

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  res.json({
    product: {
      id: product.id,
      title: product.title,
      handle: product.handle,
      thumbnail: product.thumbnail,
      description: product.description,
    },
    fit_rule: matchedRule
      ? {
          silhouette: matchedRule.silhouette_name,
          fit_tendency: matchedRule.fit_tendency,
          size_delta: Number(matchedRule.recommended_size_delta),
          width_profile: matchedRule.width_profile,
          guidance: matchedRule.guidance_text,
        }
      : null,
    variants: variantData,
  });
}
