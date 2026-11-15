/**
 * Catalogue classification helpers.
 *
 * Category membership is derived from real product fields only — declared metadata first
 * (`category`, `category_type`, `department`), then a size-token fallback. Nothing here
 * invents a category the data does not support: a product that declares nothing and has no
 * recognisable size run simply appears under "All" and no category tab.
 */

import type { StoreProduct } from "@/lib/medusa";

export type CategoryKey =
  | "all"
  | "bespoke"
  | "menswear"
  | "womenswear"
  | "footwear"
  | "accessories";

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bespoke", label: "Custom Bespoke" },
  { key: "menswear", label: "Menswear" },
  { key: "womenswear", label: "Womenswear" },
  { key: "footwear", label: "Footwear" },
  { key: "accessories", label: "Accessories" },
];

export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export interface PriceBucket {
  key: string;
  label: string;
  min: number;
  max: number | null;
}

export const PRICE_BUCKETS: PriceBucket[] = [
  { key: "under_10k", label: "Under ₹10,000", min: 0, max: 9999 },
  { key: "10k_25k", label: "₹10,000 – ₹25,000", min: 10000, max: 24999 },
  { key: "25k_50k", label: "₹25,000 – ₹50,000", min: 25000, max: 49999 },
  { key: "50k_plus", label: "₹50,000 +", min: 50000, max: null },
];

const SHOE_SIZE_PATTERN = /^uk\s*\d+(\.\d+)?$/i;
const WORD_SUFFIX = /[\s._-]+$/;

function metaString(product: StoreProduct, key: string): string | null {
  const value = product.metadata?.[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** `UK 8.0` and `UK 8` are the same size on the shelf. */
export function normaliseSize(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(WORD_SUFFIX, "");
  if (!trimmed) return null;
  const shoe = /^uk\s*(\d+)\.0$/i.exec(trimmed);
  if (shoe) return `UK ${shoe[1]}`;
  return trimmed.toUpperCase();
}

export function isShoeSize(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return SHOE_SIZE_PATTERN.test(raw.trim()) || /^uk\s*\d/i.test(raw.trim());
}

export function productSizes(product: StoreProduct): string[] {
  const sizes: string[] = [];
  for (const variant of product.variants ?? []) {
    const size = normaliseSize(variant.title);
    if (size && !sizes.includes(size)) sizes.push(size);
  }
  return sizes;
}

export function productPriceRupees(product: StoreProduct): number | null {
  const variants = product.variants ?? [];
  for (const variant of variants) {
    const amount = variant.calculated_price?.calculated_amount;
    if (typeof amount === "number" && amount >= 0) return amount;
  }
  return null;
}

export function brandOf(product: StoreProduct): string | null {
  return metaString(product, "brand") ?? metaString(product, "brand_name");
}

export function productCategories(product: StoreProduct): CategoryKey[] {
  const keys = new Set<CategoryKey>();

  const declared = [
    metaString(product, "category"),
    metaString(product, "category_type"),
    metaString(product, "department"),
    product.collection?.handle ?? null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  const title = product.title.toLowerCase();
  const sizes = productSizes(product);
  const shoeSized = sizes.length > 0 && sizes.every(isShoeSize);
  const apparelSized = sizes.some((size) =>
    (APPAREL_SIZES as readonly string[]).includes(size),
  );

  if (
    /bespoke|custom|made.to.measure|tailor/.test(declared) ||
    product.metadata?.bespoke === true ||
    /bespoke|made.to.measure|custom.tailor/.test(title)
  ) {
    keys.add("bespoke");
  }

  if (
    /footwear|sneaker|shoe/.test(declared) ||
    (!declared && shoeSized) ||
    (shoeSized && !apparelSized)
  ) {
    keys.add("footwear");
  }

  if (
    /accessor|fragrance|eyewear|jewel|bag|belt|cap|hat/.test(declared) ||
    /accessor|fragrance|eyewear|jewel/.test(title)
  ) {
    keys.add("accessories");
  }

  const gender = `${metaString(product, "gender") ?? ""} ${metaString(product, "department") ?? ""}`.toLowerCase();
  const looksUnisex = /\bunisex\b/.test(gender);
  const looksWomens = looksUnisex || /\bwomen|\bwomens\b|\bwoman|\bfemale/.test(gender);
  const looksMens = looksUnisex || (!looksWomens && /\bmen\b|\bmens\b|\bman\b|\bmale/.test(gender));

  if (looksMens) keys.add("menswear");
  if (looksWomens) keys.add("womenswear");

  // An apparel piece with an XS–XXL run and no declared department is menswear by default
  // only when the title/collection does not read as womenswear — never invent both.
  if (!looksMens && !looksWomens && apparelSized && !/dress|skirt|blouse|gown|saree|lehenga/.test(title)) {
    keys.add("menswear");
  }

  return Array.from(keys);
}

/**
 * Whether a PDP should offer made-to-measure. True when the product declares an apparel
 * category or actually ships an XS–XXL run — never for a shoe or an accessory.
 */
export function isApparelProduct(product: StoreProduct): boolean {
  const categories = productCategories(product);
  if (categories.includes("footwear") || categories.includes("accessories")) return false;
  if (categories.includes("bespoke") || categories.includes("menswear") || categories.includes("womenswear")) {
    return true;
  }
  const declared = `${metaString(product, "category") ?? ""} ${metaString(product, "category_type") ?? ""}`.toLowerCase();
  if (/shirt|trouser|suit|blazer|dress|co-?ord|jacket|apparel|ready.to.wear/.test(declared)) return true;
  return productSizes(product).some((size) => (APPAREL_SIZES as readonly string[]).includes(size));
}

export function matchesCategory(product: StoreProduct, category: CategoryKey): boolean {
  if (category === "all") return true;
  return productCategories(product).includes(category);
}

export function priceBucketOf(product: StoreProduct): PriceBucket | null {
  const price = productPriceRupees(product);
  if (price === null) return null;
  return PRICE_BUCKETS.find((bucket) => price >= bucket.min && (bucket.max === null || price <= bucket.max)) ?? null;
}

export function matchesPriceBucket(product: StoreProduct, bucketKey: string): boolean {
  if (!bucketKey) return true;
  const bucket = PRICE_BUCKETS.find((item) => item.key === bucketKey);
  if (!bucket) return true;
  const price = productPriceRupees(product);
  if (price === null) return false;
  return price >= bucket.min && (bucket.max === null || price <= bucket.max);
}

export function productHasAnySize(product: StoreProduct, sizeTokens: string[]): boolean {
  if (sizeTokens.length === 0) return true;
  const sizes = productSizes(product);
  return sizes.some((size) => sizeTokens.includes(size));
}
