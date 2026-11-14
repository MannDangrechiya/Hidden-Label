import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { actorId } from "../../../../lib/auth";

interface PlaceBidBody {
  variant_id?: string;
  bid_price?: number;
  payment_intent?: string;
  expires_in_days?: number;
}

interface CustomerBidRow {
  id: string;
  variant_id: string;
  bid_price: string | number;
  status: string;
  expires_at: string;
  created_at: string;
  variant_title: string;
  variant_sku: string | null;
  product_id: string;
  product_title: string;
  product_handle: string;
  thumbnail: string | null;
}

/**
 * POST /store/resale/bids — Place a bid on a sneaker variant.
 * GET /store/resale/bids — List current customer's bids.
 */
export async function POST(req: MedusaRequest<PlaceBidBody>, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to place a bid." });
    return;
  }

  const { variant_id, bid_price, payment_intent, expires_in_days } = req.body ?? {};

  if (!variant_id || typeof variant_id !== "string") {
    res.status(400).json({ type: "invalid_data", message: "variant_id is required." });
    return;
  }

  const priceNum = Number(bid_price);
  if (isNaN(priceNum) || priceNum <= 0) {
    res.status(400).json({ type: "invalid_data", message: "bid_price must be a positive number." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Validate variant exists
  const variant = await pg("product_variant")
    .where({ id: variant_id })
    .whereNull("deleted_at")
    .first();

  if (!variant) {
    res.status(404).json({ type: "not_found", message: "Product variant not found." });
    return;
  }

  const days = expires_in_days && expires_in_days > 0 && expires_in_days <= 90 ? expires_in_days : 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const id = generateEntityId(undefined, "bid");
  await pg("resale_bid").insert({
    id,
    variant_id,
    buyer_id: customerId,
    bid_price: priceNum,
    status: "active",
    payment_intent: payment_intent ?? null,
    expires_at: expiresAt,
  });

  const created = await pg("resale_bid").where({ id }).first();

  res.status(201).json({
    bid: {
      id: created.id,
      variant_id: created.variant_id,
      bid_price: Number(created.bid_price),
      status: created.status,
      expires_at: created.expires_at,
      created_at: created.created_at,
    },
  });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to view your bids." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const bids = (await pg("resale_bid as b")
    .join("product_variant as pv", "pv.id", "b.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .where("b.buyer_id", customerId)
    .whereNull("b.deleted_at")
    .orderBy("b.created_at", "desc")
    .select(
      "b.id",
      "b.variant_id",
      "b.bid_price",
      "b.status",
      "b.expires_at",
      "b.created_at",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.thumbnail",
    )) as CustomerBidRow[];

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    bids: bids.map((b) => ({
      id: b.id,
      variant_id: b.variant_id,
      bid_price: Number(b.bid_price),
      status: b.status,
      expires_at: b.expires_at,
      created_at: b.created_at,
      variant: {
        size: b.variant_title,
        sku: b.variant_sku,
      },
      product: {
        id: b.product_id,
        title: b.product_title,
        handle: b.product_handle,
        thumbnail: b.thumbnail,
      },
    })),
  });
}
