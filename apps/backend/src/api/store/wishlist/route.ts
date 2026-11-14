import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { THL_MODULE } from "../../../modules/thl";
import { actorId } from "../../../lib/auth";
import type ThlModuleService from "../../../modules/thl/service";

/** GET/POST/DELETE /store/wishlist — scoped to the authenticated customer only. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to use your saved list." });
    return;
  }

  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const items = await thl.listWishlistItems(
    { customer_id: customerId },
    { order: { created_at: "DESC" } },
  );

  res.setHeader("Cache-Control", "private, no-store");
  res.json({ items });
}

export async function POST(req: MedusaRequest<{ variant_id?: string }>, res: MedusaResponse) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to save items." });
    return;
  }

  const variantId = req.body?.variant_id;
  if (!variantId) {
    res.status(400).json({ type: "invalid_data", message: "variant_id is required." });
    return;
  }

  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const existing = await thl.listWishlistItems({ customer_id: customerId, variant_id: variantId });
  if (existing[0]) {
    res.status(200).json({ item: existing[0], created: false });
    return;
  }

  const item = await thl.createWishlistItems({ customer_id: customerId, variant_id: variantId });
  res.status(201).json({ item, created: true });
}

export async function DELETE(
  req: MedusaRequest<unknown, { variant_id?: string }>,
  res: MedusaResponse,
) {
  const customerId = actorId(req);
  if (!customerId) {
    res.status(401).json({ type: "unauthorized", message: "Sign in to manage saved items." });
    return;
  }

  const variantId = req.query.variant_id;
  if (!variantId) {
    res.status(400).json({ type: "invalid_data", message: "variant_id is required." });
    return;
  }

  const thl = req.scope.resolve<ThlModuleService>(THL_MODULE);
  const items = await thl.listWishlistItems({ customer_id: customerId, variant_id: variantId });
  if (items[0]) await thl.deleteWishlistItems(items[0].id);

  res.json({ deleted: Boolean(items[0]) });
}

