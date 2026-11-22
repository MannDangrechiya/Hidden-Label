import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { randomBytes } from "node:crypto";
import { actorId } from "../../../../../lib/auth";

interface CreateReviewBody {
  rating?: number;
  title?: string;
  body?: string;
  author_name?: string;
}

/**
 * GET /store/products/:id/reviews — Public list of approved reviews and truthful rating aggregations.
 */
export async function GET(
  req: MedusaRequest & { params: { id: string } },
  res: MedusaResponse,
) {
  const productId = req.params.id;
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  const reviews = await pg("product_review")
    .where({ product_id: productId, status: "approved" })
    .orderBy("created_at", "desc")
    .select(
      "id",
      "rating",
      "title",
      "body",
      "author_name",
      "verified_purchase",
      "created_at",
    );

  const count = reviews.length;
  let totalRating = 0;
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const rev of reviews) {
    const r = Number(rev.rating);
    totalRating += r;
    if (distribution[r] !== undefined) {
      distribution[r] += 1;
    }
  }

  const averageRating = count > 0 ? Number((totalRating / count).toFixed(1)) : 0;

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json({
    reviews,
    stats: {
      count,
      average_rating: averageRating,
      distribution,
    },
  });
}

/**
 * POST /store/products/:id/reviews — Authenticated review submission with purchase verification.
 */
export async function POST(
  req: MedusaRequest<CreateReviewBody> & { params: { id: string } },
  res: MedusaResponse,
) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({
      type: "unauthorized",
      message: "Please sign in to submit a product review.",
    });
    return;
  }

  const productId = req.params.id;
  const body = req.body ?? {};
  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({
      type: "invalid_data",
      message: "A rating between 1 and 5 is required.",
    });
    return;
  }

  const title = body.title?.trim();
  const reviewBody = body.body?.trim();
  const authorName = body.author_name?.trim() || "Verified Buyer";

  if (!title || title.length < 3) {
    res.status(400).json({
      type: "invalid_data",
      message: "A review title of at least 3 characters is required.",
    });
    return;
  }

  if (!reviewBody || reviewBody.length < 10) {
    res.status(400).json({
      type: "invalid_data",
      message: "A detailed review body of at least 10 characters is required.",
    });
    return;
  }

  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);

  // Check if customer already reviewed this product
  const existingReview = await pg("product_review")
    .where({ product_id: productId, customer_id: customerId })
    .first("id");

  if (existingReview) {
    res.status(409).json({
      type: "duplicate_review",
      message: "You have already submitted a review for this product.",
    });
    return;
  }

  // P5-01: Server-side purchase verification
  const purchase = await pg("order as o")
    .join("order_item as oi", "oi.order_id", "o.id")
    .where("o.customer_id", customerId)
    .where(function() {
      this.where("oi.item_id", productId).orWhere("oi.id", productId);
    })
    .whereNull("o.deleted_at")
    .whereNull("o.canceled_at")
    .first("o.id");

  const verifiedPurchase = Boolean(purchase);
  const reviewId = `rev_${randomBytes(8).toString("hex")}`;

  const [review] = await pg("product_review")
    .insert({
      id: reviewId,
      product_id: productId,
      customer_id: customerId,
      rating,
      title,
      body: reviewBody,
      author_name: authorName,
      verified_purchase: verifiedPurchase,
      status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning("*");

  res.status(201).json({
    review,
    message: "Review submitted successfully. It will appear once approved by moderation.",
  });
}
