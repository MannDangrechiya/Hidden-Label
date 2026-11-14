import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";

interface VariantRow {
  id: string;
  title: string;
  sku: string;
  product_id: string;
  product_title: string;
  product_handle: string;
  thumbnail: string | null;
}

interface PriceRow {
  variant_id: string;
  amount: number;
}

export default async function seedPhase55({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  logger.info("Starting Phase 5.5 seed (Resale, Bidding, Price Index, Fit Rules, Inspections)...");

  /* --- 1. Fit Rules -------------------------------------------------------- */
  const fitRules = [
    {
      silhouette_name: "Air Jordan 1",
      fit_tendency: "true_to_size",
      recommended_size_delta: 0.0,
      width_profile: "regular",
      guidance_text:
        "Air Jordan 1 fits true to size with standard basketball shoe volume. Wearers with particularly wide feet may opt for a half size up for relaxed forefoot comfort.",
    },
    {
      silhouette_name: "Samba OG",
      fit_tendency: "runs_narrow",
      recommended_size_delta: 0.5,
      width_profile: "narrow",
      guidance_text:
        "Adidas Samba OG features a low-profile football terrace silhouette with a snug toe box. We strongly recommend sizing up half a size if you have normal to wide feet.",
    },
    {
      silhouette_name: "Dunk Low",
      fit_tendency: "true_to_size",
      recommended_size_delta: 0.0,
      width_profile: "regular",
      guidance_text:
        "Nike Dunk Low fits true to size. Standard foot profiles can order their usual UK sneaker size with comfortable lace-up room.",
    },
    {
      silhouette_name: "990v6",
      fit_tendency: "runs_large",
      recommended_size_delta: -0.5,
      width_profile: "regular",
      guidance_text:
        "New Balance 990v6 runs slightly roomy in length due to the extended FuelCell tooling. If you prefer a snug lock-in, take half a size down.",
    },
    {
      silhouette_name: "Gel-Kayano 14",
      fit_tendency: "true_to_size",
      recommended_size_delta: 0.0,
      width_profile: "regular",
      guidance_text:
        "ASICS Gel-Kayano 14 fits standard true to size with superior arch and heel cup lockdown engineered from its heritage running DNA.",
    },
    {
      silhouette_name: "XT-6",
      fit_tendency: "runs_narrow",
      recommended_size_delta: 0.5,
      width_profile: "narrow",
      guidance_text:
        "Salomon XT-6 is built with a technical Sensifit trail cage. Sizing up half a size provides the ideal everyday lifestyle fit.",
    },
    {
      silhouette_name: "Gazelle Indoor",
      fit_tendency: "true_to_size",
      recommended_size_delta: 0.0,
      width_profile: "regular",
      guidance_text:
        "Adidas Gazelle Indoor features supple suede that conforms quickly to your foot. Order your true UK size.",
    },
    {
      silhouette_name: "Air Jordan 4",
      fit_tendency: "runs_small",
      recommended_size_delta: 0.5,
      width_profile: "narrow",
      guidance_text:
        "Air Jordan 4 features side wing eyelets and a rigid forefoot cage that can feel snug at the pinky toe. We recommend going up half a size.",
    },
  ];

  for (const rule of fitRules) {
    const existing = await pg("silhouette_fit_rule").where({ silhouette_name: rule.silhouette_name }).first();
    if (!existing) {
      await pg("silhouette_fit_rule").insert({
        id: generateEntityId(undefined, "fit"),
        silhouette_name: rule.silhouette_name,
        fit_tendency: rule.fit_tendency,
        recommended_size_delta: rule.recommended_size_delta,
        width_profile: rule.width_profile,
        guidance_text: rule.guidance_text,
      });
    }
  }
  logger.info(`Silhouette fit rules seeded: ${fitRules.length}`);

  /* --- 2. Customers for Asks & Bids ---------------------------------------- */
  const customers = await pg("customer").select("id", "email").limit(2);
  let sellerId = customers[0]?.id;
  let buyerId = customers[1]?.id ?? customers[0]?.id;

  if (!sellerId) {
    sellerId = generateEntityId(undefined, "cus");
    await pg("customer").insert({
      id: sellerId,
      email: "consignment.seller@thehiddenlabel.com",
      first_name: "Verified",
      last_name: "Consignor",
    });
  }
  if (!buyerId) {
    buyerId = generateEntityId(undefined, "cus");
    await pg("customer").insert({
      id: buyerId,
      email: "sneaker.bidder@thehiddenlabel.com",
      first_name: "Active",
      last_name: "Collector",
    });
  }

  /* --- 3. Variants & Catalog Data ------------------------------------------- */
  const variants = (await pg("product_variant as pv")
    .join("product as p", "p.id", "pv.product_id")
    .whereNull("p.deleted_at")
    .whereNull("pv.deleted_at")
    .select(
      "pv.id",
      "pv.title",
      "pv.sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.thumbnail"
    )) as VariantRow[];

  logger.info(`Found ${variants.length} active variants across catalogue`);

  // Fetch variant base prices
  const priceRows = (await pg("price as pr")
    .join("price_set as ps", "ps.id", "pr.price_set_id")
    .join("product_variant_price_set as pvps", "pvps.price_set_id", "ps.id")
    .select("pvps.variant_id", "pr.amount")) as PriceRow[];

  const priceMap = new Map<string, number>();
  for (const pr of priceRows) {
    if (!priceMap.has(pr.variant_id)) {
      priceMap.set(pr.variant_id, Number(pr.amount));
    }
  }

  let totalPoints = 0;
  let totalAsks = 0;
  let totalBids = 0;
  let totalInspections = 0;

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const variant of variants) {
    const basePrice = priceMap.get(variant.id) ?? 15000;

    /* A. Price History Points (AI-02 The Price Index) */
    const existingPoints = await pg("price_history_point").where({ variant_id: variant.id }).first();
    if (!existingPoints) {
      // Generate 7-10 historical sales points over 90 days
      const daysOffsets = [90, 75, 60, 45, 30, 20, 10, 5, 1];
      const varianceFactors = [-0.08, -0.04, 0.02, 0.05, 0.01, -0.02, 0.04, 0.03, 0.0];

      const pointsToInsert = daysOffsets.map((daysAgo, idx) => {
        const factor = varianceFactors[idx] ?? 0;
        const tradePrice = Math.round(basePrice * (1 + factor));
        const recordedAt = new Date(now - daysAgo * DAY_MS);

        return {
          id: generateEntityId(undefined, "php"),
          variant_id: variant.id,
          price_rupees: tradePrice,
          condition_grade: "deadstock",
          source: "marketplace",
          recorded_at: recordedAt,
        };
      });

      await pg("price_history_point").insert(pointsToInsert);
      totalPoints += pointsToInsert.length;
    }

    /* B. Resale Asks (Orderbook sellers) */
    const existingAsk = await pg("resale_ask").where({ variant_id: variant.id, status: "active" }).first();
    if (!existingAsk) {
      // 2 asks per variant: one lowest ask near market, one premium deadstock
      const asks = [
        {
          id: generateEntityId(undefined, "ask"),
          variant_id: variant.id,
          seller_id: sellerId,
          ask_price: Math.round(basePrice * 1.02),
          condition_grade: "deadstock",
          box_condition: "perfect",
          status: "active",
        },
        {
          id: generateEntityId(undefined, "ask"),
          variant_id: variant.id,
          seller_id: sellerId,
          ask_price: Math.round(basePrice * 1.08),
          condition_grade: "deadstock",
          box_condition: "perfect",
          status: "active",
        },
      ];
      await pg("resale_ask").insert(asks);
      totalAsks += asks.length;
    }

    /* C. Resale Bids (Orderbook buyers) */
    const existingBid = await pg("resale_bid").where({ variant_id: variant.id, status: "active" }).first();
    if (!existingBid) {
      const bids = [
        {
          id: generateEntityId(undefined, "bid"),
          variant_id: variant.id,
          buyer_id: buyerId,
          bid_price: Math.round(basePrice * 0.92),
          status: "active",
          expires_at: new Date(now + 25 * DAY_MS),
        },
        {
          id: generateEntityId(undefined, "bid"),
          variant_id: variant.id,
          buyer_id: buyerId,
          bid_price: Math.round(basePrice * 0.88),
          status: "active",
          expires_at: new Date(now + 14 * DAY_MS),
        },
      ];
      await pg("resale_bid").insert(bids);
      totalBids += bids.length;
    }

    /* D. Condition Inspection (AI-03 360° Inspection Viewer) */
    const existingInspection = await pg("condition_inspection").where({ variant_id: variant.id }).first();
    if (!existingInspection) {
      const safeSku = (variant.sku || variant.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
      const unitSerial = `THL-${safeSku}-${variant.title.replace(/[^A-Za-z0-9]/g, "")}-DS01`;

      // 8 turntable angles simulating 360 rotation
      const thumb = variant.thumbnail || "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80";
      const turntableMedia = [
        `${thumb}&angle=0`,
        `${thumb}&angle=45`,
        `${thumb}&angle=90`,
        `${thumb}&angle=135`,
        `${thumb}&angle=180`,
        `${thumb}&angle=225`,
        `${thumb}&angle=270`,
        `${thumb}&angle=315`,
      ];

      const detailPhotos = [
        { label: "Toe Box & Perforations", url: `${thumb}&macro=toebox` },
        { label: "Medial & Lateral Stitching", url: `${thumb}&macro=stitching` },
        { label: "Outsole Traction Pattern", url: `${thumb}&macro=outsole` },
        { label: "Inner Size Tag & UV Matrix", url: `${thumb}&macro=sizetag` },
      ];

      const checklist = {
        box_label_qr_match: "verified_authentic",
        uv_light_stitching: "verified_authentic",
        insole_stamping: "intact_unworn",
        outsole_traction: "factory_deadstock_zero_wear",
        scent_profile: "factory_deadstock_adhesive",
        accessories_complete: true,
      };

      await pg("condition_inspection").insert({
        id: generateEntityId(undefined, "ins"),
        variant_id: variant.id,
        unit_serial: unitSerial,
        status: "approved",
        condition_grade: "Deadstock 10/10",
        box_condition: "perfect",
        turntable_media: JSON.stringify(turntableMedia),
        detail_photos: JSON.stringify(detailPhotos),
        checklist: JSON.stringify(checklist),
        notes: "Factory deadstock condition. Verified under 40x magnification and 365nm UV spectrum. Zero sole oxidation, clean stitches, intact packaging.",
        inspected_at: new Date(),
      });
      totalInspections++;
    }
  }

  logger.info(`Price history points seeded: ${totalPoints}`);
  logger.info(`Resale asks seeded: ${totalAsks}`);
  logger.info(`Resale bids seeded: ${totalBids}`);
  logger.info(`Condition inspections seeded: ${totalInspections}`);
  logger.info("Phase 5.5 seed complete!");
}
