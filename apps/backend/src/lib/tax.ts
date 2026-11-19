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

  return { regionId: region.id, createdRates: created, existingRates: existing };
}
