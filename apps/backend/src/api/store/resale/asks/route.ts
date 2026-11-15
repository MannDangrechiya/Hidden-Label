import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { actorId } from "../../../../lib/auth";

interface PlaceAskBody {
  variant_id?: string;
  ask_price?: number;
  condition_grade?: string;
  box_condition?: string;
}

interface SellerAskRow {
  id: string;
  variant_id: string;
  ask_price: string | number;
  condition_grade: string;
  box_condition: string;
  status: string;
  created_at: string;
  variant_title: string;
  variant_sku: string | null;
  product_id: string;
  product_title: string;
  product_handle: string;
  thumbnail: string | null;
}

/**
 * POST /store/resale/asks — List a pair for sale (authenticated seller/consignor).
 * GET /store/resale/asks — List seller's active asks.
 */
export async function POST(req: MedusaRequest<PlaceAskBody>, res: MedusaResponse) {
  const sellerId = actorId(req);
  if (!sellerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to list items for sale." });
    return;
  }

  const { variant_id, ask_price, condition_grade, box_condition } = req.body ?? {};

  if (!variant_id || typeof variant_id !== "string") {
    res.status(400).json({ type: "invalid_data", message: "variant_id is required." });
    return;
  }

  const priceNum = Number(ask_price);
  if (isNaN(priceNum) || priceNum <= 0) {
    res.status(400).json({ type: "invalid_data", message: "ask_price must be a positive number." });
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

  const id = generateEntityId(undefined, "ask");
  await pg("resale_ask").insert({
    id,
    variant_id,
    seller_id: sellerId,
    ask_price: priceNum,
    condition_grade: condition_grade ?? "deadstock",
    box_condition: box_condition ?? "perfect",
    status: "active",
  });

  const created = await pg("resale_ask").where({ id }).first();

  res.status(201).json({
    ask: {
      id: created.id,
      variant_id: created.variant_id,
      ask_price: Number(created.ask_price),
      condition_grade: created.condition_grade,
      box_condition: created.box_condition,
      status: created.status,
      created_at: created.created_at,
    },
  });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellerId = actorId(req);
  if (!sellerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to view your listings." });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const statusFilter = (req.query as Record<string, string | undefined>)?.status ?? "active";
  const query = pg("resale_ask as a")
    .join("product_variant as pv", "pv.id", "a.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .where("a.seller_id", sellerId)
    .whereNull("a.deleted_at");

  if (statusFilter !== "all") {
    query.where("a.status", statusFilter);
  }

  const asks = (await query
    .orderBy("a.created_at", "desc")
    .select(
      "a.id",
      "a.variant_id",
      "a.ask_price",
      "a.condition_grade",
      "a.box_condition",
      "a.status",
      "a.created_at",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.thumbnail",
    )) as SellerAskRow[];

  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    asks: asks.map((a) => ({
      id: a.id,
      variant_id: a.variant_id,
      ask_price: Number(a.ask_price),
      condition_grade: a.condition_grade,
      box_condition: a.box_condition,
      status: a.status,
      created_at: a.created_at,
      variant: {
        size: a.variant_title,
        sku: a.variant_sku,
      },
      product: {
        id: a.product_id,
        title: a.product_title,
        handle: a.product_handle,
        thumbnail: a.thumbnail,
      },
    })),
  });
}
