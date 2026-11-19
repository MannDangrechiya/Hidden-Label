/**
 * Backend mirror of the storefront's HSN classifier — used when seeding product metadata.
 * Kept local because the Medusa backend does not compile workspace TypeScript packages.
 */
export interface HsnInput {
  title: string;
  category?: string;
  gender?: string;
}

const FOOTWEAR = /sneaker|shoe|footwear|jordan|samba|dunk|gazelle|kayano|xt-6|990v6|boot|loafer/i;
const EYEWEAR = /sunglass|eyewear|frame/i;
const FRAGRANCE = /parfum|perfume|oud|fragrance|eau de/i;
const BAGS = /bag|backpack|tote|wallet|belt/i;
const KNITWEAR = /t-shirt|tee|jersey|hoodie|sweatshirt|pullover/i;

export function hsnForProduct(input: HsnInput): string {
  const text = input.title;
  if (FOOTWEAR.test(text) || input.category === "footwear") return "6403";
  if (EYEWEAR.test(text)) return "9004";
  if (FRAGRANCE.test(text)) return "3303";
  if (BAGS.test(text)) return "4202";
  if (KNITWEAR.test(text)) return input.gender === "women" ? "6110" : "6109";
  return input.gender === "women" ? "6204" : "6203";
}

/**
 * Conservative shipping dimensions per category, in centimetres and kilograms. Used as the
 * fallback when a product has no explicit `package_*` metadata and passed to Shiprocket so
 * the parcel is not labelled with a universal 30×20×12 / 0.6 kg box (GAP-LOG-02).
 */
export const PACKAGE_BY_CATEGORY: Record<string, { length: number; breadth: number; height: number; weight: number }> = {
  footwear: { length: 34, breadth: 24, height: 13, weight: 1.1 },
  ready_to_wear: { length: 32, breadth: 26, height: 8, weight: 0.55 },
  bespoke_custom: { length: 32, breadth: 26, height: 8, weight: 0.6 },
  accessory: { length: 22, breadth: 18, height: 10, weight: 0.4 },
};
