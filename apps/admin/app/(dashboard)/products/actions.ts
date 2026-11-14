"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  updateProduct,
  setProductStatus,
  upsertVariants,
  fetchDefaultSalesChannel,
  type ProductStatus,
} from "../../../lib/api/products";
import { BackendError } from "../../../lib/backend";

export interface ProductFormState {
  error?: string;
}

/** A-03 — Add Product Flow. A single "Size" option with one price applied to every variant;
 * per-variant prices can be refined afterwards on the edit page. */
export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sizesRaw = String(formData.get("sizes") ?? "").trim();
  const priceRupees = Number(formData.get("price_rupees"));
  const categoryId = String(formData.get("category_id") ?? "");
  const thumbnail = String(formData.get("thumbnail") ?? "").trim();

  if (!title) return { error: "A title is required." };
  if (!Number.isFinite(priceRupees) || priceRupees <= 0) {
    return { error: "A positive price is required." };
  }

  const sizes = sizesRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (sizes.length === 0) return { error: "At least one size is required." };

  // Money is a plain rupee integer everywhere in this project (docs/DATABASE_PLAN.md §13) —
  // do not multiply by 100. Confirmed live: entering "999" here previously stored 99900,
  // making the product display as ₹99,900 instead of ₹999 everywhere it's shown.
  const amount = Math.round(priceRupees);

  try {
    const channel = await fetchDefaultSalesChannel();
    const product = await createProduct({
      title,
      description: description || null,
      thumbnail: thumbnail || null,
      categories: categoryId ? [{ id: categoryId }] : undefined,
      sales_channels: channel ? [{ id: channel.id }] : undefined,
      options: [{ title: "Size", values: sizes }],
      variants: sizes.map((size) => ({
        title: `${title} / ${size}`,
        options: { Size: size },
        prices: [{ currency_code: "inr", amount }],
      })),
    });
    revalidatePath("/products");
    redirect(`/products/${product.id}`);
  } catch (error) {
    if (error instanceof BackendError) return { error: error.message };
    throw error;
  }
}

export async function updateProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const thumbnail = String(formData.get("thumbnail") ?? "").trim();

  if (!title) return { error: "A title is required." };

  try {
    await updateProduct(id, { title, description: description || null, thumbnail: thumbnail || null });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not save changes." };
  }
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
  return {};
}

export async function setProductStatusAction(id: string, status: ProductStatus): Promise<void> {
  await setProductStatus(id, status);
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");
}

export interface VariantPriceFormState {
  error?: string;
}

export async function updateVariantPriceAction(
  _prev: VariantPriceFormState,
  formData: FormData,
): Promise<VariantPriceFormState> {
  const productId = String(formData.get("product_id") ?? "");
  const variantId = String(formData.get("variant_id") ?? "");
  const priceId = String(formData.get("price_id") ?? "") || undefined;
  const priceRupees = Number(formData.get("price_rupees"));

  if (!Number.isFinite(priceRupees) || priceRupees <= 0) {
    return { error: "A positive price is required." };
  }

  try {
    await upsertVariants(productId, {
      update: [
        {
          id: variantId,
          prices: [{ id: priceId, currency_code: "inr", amount: Math.round(priceRupees) }],
        },
      ],
    });
  } catch (error) {
    return { error: error instanceof BackendError ? error.message : "Could not update the price." };
  }
  revalidatePath(`/products/${productId}`);
  return {};
}
