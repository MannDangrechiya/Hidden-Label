import type { Knex } from "knex";
import { generateEntityId } from "@medusajs/framework/utils";

/**
 * GAP-TAX-01: Medusa's tax engine ships with an empty `tax_region` / `tax_rate` pair, so
 * every cart computed `tax_total = 0`. This seeds the India GST setup:
 *
 *  - one country-level `tax_region` for India, served by the built-in `tp_system` provider;
 *  - the four standard GST slabs (5 / 12 / 18 / 28 percent), 18 percent marked default
 *    because the catalogue is luxury apparel and footwear;
 *  - idempotent: re-running never duplicates a region or a slab.
 *
 * It also seeds the pricing module's `price_preference` for INR as tax-inclusive. The catalogue
 * is priced tax-inclusive (₹8,490 is what the customer pays, GST included — see the storefront
 * copy "Inclusive of duties and GST" and `packages/shared/src/gst.ts` which splits inclusive
 * totals). Without this preference Medusa defaults `is_tax_inclusive` to false and the tax
 * engine stacks 18% on top of already-inclusive prices, which is exactly the ₹8,490 × 2 →
 * ₹16,980 → ₹20,036.40 reconciliation bug. With it, the cart, checkout, order and Razorpay
 * amount all reconcile to the tax-inclusive total and GST is applied exactly once.
 *
 * Rate values are percentages, the unit Medusa stores and divides by 100 when it computes a
 * tax line.
 */
export const INDIA_TAX_PROVIDER = "tp_system";

export const GST_SLABS = [
  { rate: 5, code: "GST5", name: "GST 5% — essential goods" },
  { rate: 12, code: "GST12", name: "GST 12% — apparel under threshold" },
  { rate: 18, code: "GST18", name: "GST 18% — luxury apparel, footwear, accessories" },
  { rate: 28, code: "GST28", name: "GST 28% — demerit goods" },
] as const;

export interface TaxSeedResult {
  regionId: string;
  createdRates: string[];
  existingRates: string[];
  /** True when the INR price preference had to be created or corrected. */
  pricePreferenceUpdated: boolean;
}

export async function ensureIndiaTaxSetup(pg: Knex): Promise<TaxSeedResult> {
  let region = await pg("tax_region")
    .where({ country_code: "in" })
    .whereNull("province_code")
    .whereNull("deleted_at")
    .first("id");

  if (!region) {
    const id = generateEntityId(undefined, "txr");
    await pg("tax_region").insert({
      id,
      country_code: "in",
      province_code: null,
      parent_id: null,
      provider_id: INDIA_TAX_PROVIDER,
      metadata: JSON.stringify({ seeded: true, country: "India", source: "remediation-phase-2" }),
    });
    region = { id };
  }

  const created: string[] = [];
  const existing: string[] = [];

  for (const slab of GST_SLABS) {
    const row = await pg("tax_rate")
      .where({ tax_region_id: region.id, code: slab.code })
      .whereNull("deleted_at")
      .first("id");

    if (row) {
      existing.push(slab.code);
      continue;
    }

    await pg("tax_rate").insert({
      id: generateEntityId(undefined, "txr"),
      rate: slab.rate,
      code: slab.code,
      name: slab.name,
      is_default: slab.rate === 18,
      is_combinable: false,
      tax_region_id: region.id,
      metadata: JSON.stringify({ seeded: true, gst: true }),
    });
    created.push(slab.code);
  }

  // The default slab must be unambiguous: if a previous run left another default behind,
  // clear it so Medusa's resolver cannot pick two.
  await pg("tax_rate")
    .where({ tax_region_id: region.id })
    .whereNot({ code: "GST18" })
    .update({ is_default: false, updated_at: new Date() });

  const pricePreferenceUpdated = await ensureIndiaPricePreference(pg);

  return { regionId: region.id, createdRates: created, existingRates: existing, pricePreferenceUpdated };
}

/**
 * Marks every INR price as tax-inclusive via the pricing module's `price_preference` table.
 *
 * Medusa resolves tax inclusivity per currency/region preference and falls back to
 * `false` (tax-exclusive) when no preference row exists — so by default the GST18 slab is
 * added on top of catalogue prices that already contain GST. This row makes the pricing
 * module report `is_tax_inclusive: true`, which the cart module then carries onto line items
 * and shipping methods, so `calculateTaxTotal` divides the inclusive price instead of
 * stacking tax on top of it.
 *
 * Idempotent: creates the row once; corrects a row that exists with the wrong value.
 */
export async function ensureIndiaPricePreference(pg: Knex): Promise<boolean> {
  const existing = await pg("price_preference")
    .where({ attribute: "currency_code", value: "inr" })
    .whereNull("deleted_at")
    .first<{ id: string; is_tax_inclusive: boolean }>("id", "is_tax_inclusive");

  if (existing) {
    if (existing.is_tax_inclusive) return false;
    await pg("price_preference")
      .where({ id: existing.id })
      .update({ is_tax_inclusive: true, updated_at: new Date() });
    return true;
  }

  await pg("price_preference").insert({
    id: generateEntityId(undefined, "prpref"),
    attribute: "currency_code",
    value: "inr",
    is_tax_inclusive: true,
  });
  return true;
}
