import type { Knex } from "knex";
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * D4: admin-created/updated products carry their brand as free-text `metadata.brand` (the
 * seed stores the brand *name* there), but nothing wrote the `product_brand` link table, so
 * the Brands page showed no association for any product made through the admin.
 *
 * This subscriber links the product to the matching existing `brand` row — case-insensitive
 * against the brand's name or handle. A brand that does not exist is never invented from
 * product input: the link is simply skipped.
 *
 * Idempotent: the link insert ignores conflicts on (product_id, brand_id), so a re-run on
 * product.updated never duplicates a link.
 */

export async function linkProductBrand(
  pg: Knex,
  productId: string,
): Promise<string | null> {
  const product = (await pg("product")
    .where({ id: productId })
    .whereNull("deleted_at")
    .first("id", "metadata")) as { id: string; metadata: Record<string, unknown> | null } | undefined;

  const brandName = product?.metadata?.brand;
  if (!product || typeof brandName !== "string" || !brandName.trim()) {
    return null;
  }

  const needle = brandName.trim().toLowerCase();
  const brand = (await pg("brand")
    .whereRaw("lower(name) = ? or lower(handle) = ?", [needle, needle])
    .whereNull("deleted_at")
    .first("id")) as { id: string } | undefined;

  if (!brand) {
    return null;
  }

  await pg("product_brand")
    .insert({ product_id: product.id, brand_id: brand.id })
    .onConflict(["product_id", "brand_id"])
    .ignore();

  return brand.id;
}

export default async function productBrandLinkHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id?: string }>) {
  const productId = data.id;
  if (!productId) return;
  try {
    await linkProductBrand(
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION),
      productId,
    );
  } catch (error) {
    // A missing brand link must never fail the product create/update event.
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `Brand link for product ${productId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
};
