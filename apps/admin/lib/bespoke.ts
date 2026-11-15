import type { OrderItemLine } from "./api/orders";

/**
 * Master tailor pipeline for made-to-measure orders.
 *
 * The stage lives on `order.metadata.bespoke_stage` (see the `setBespokeStage` action) so a
 * ready-to-wear order never shows tailoring steps it will not go through.
 */
export const BESPOKE_STAGES = [
  { key: "measurements_verified", label: "Measurements Verified" },
  { key: "fabric_cutting", label: "Fabric Cutting" },
  { key: "stitching", label: "Stitching" },
  { key: "qc_passed", label: "QC Passed" },
  { key: "ready_for_pickup", label: "Ready for Pickup / Dispatched" },
] as const;

export type BespokeStage = (typeof BESPOKE_STAGES)[number]["key"];

const STAGE_KEYS = BESPOKE_STAGES.map((stage) => stage.key) as readonly string[];

export function isBespokeStage(value: unknown): value is BespokeStage {
  return typeof value === "string" && STAGE_KEYS.includes(value);
}

export function bespokeStageIndex(stage: BespokeStage | null): number {
  if (!stage) return -1;
  return BESPOKE_STAGES.findIndex((entry) => entry.key === stage);
}

export interface CustomMeasurements {
  chest_inches: number | null;
  waist_inches: number | null;
  shoulder_inches: number | null;
  sleeve_inches: number | null;
  inseam_inches: number | null;
  fit_preference: string | null;
  notes: string | null;
  base_size: string | null;
}

export interface BespokeItem {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  garmentType: string | null;
  measurements: CustomMeasurements;
}

function num(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Reads a line item's `metadata.custom_measurements`. Returns null for ready-to-wear lines so
 * callers can skip them entirely rather than rendering an empty sheet.
 */
export function bespokeItemOf(item: OrderItemLine): BespokeItem | null {
  const metadata = item.metadata;
  if (!metadata || typeof metadata !== "object") return null;

  const raw = metadata["custom_measurements"];
  const isCustom = metadata["is_custom"] === true || (raw !== null && typeof raw === "object");
  if (!isCustom || !raw || typeof raw !== "object") return null;

  const values = raw as Record<string, unknown>;
  const measurements: CustomMeasurements = {
    chest_inches: num(values["chest_inches"]),
    waist_inches: num(values["waist_inches"]),
    shoulder_inches: num(values["shoulder_inches"]),
    sleeve_inches: num(values["sleeve_inches"]),
    inseam_inches: num(values["inseam_inches"]),
    fit_preference: str(values["fit_preference"]),
    notes: str(values["notes"]),
    base_size: str(values["base_size"]),
  };

  return {
    id: item.id,
    title: item.product_title ?? item.title,
    variantTitle: item.variant_title,
    quantity: item.quantity,
    garmentType: str(metadata["garment_type"]),
    measurements,
  };
}

export function bespokeItemsOf(items: OrderItemLine[]): BespokeItem[] {
  return items
    .map((item) => bespokeItemOf(item))
    .filter((item): item is BespokeItem => item !== null);
}

/** `slim` / `regular` / `relaxed` from the storefront → a sentence the tailor can act on. */
export function fitPreferenceLabel(value: string | null): string {
  switch (value) {
    case "slim":
      return "Slim — close to the body, tapered waist";
    case "relaxed":
      return "Relaxed / Oversized — dropped shoulder, generous body";
    case "regular":
      return "Regular — house block";
    default:
      return "Not specified";
  }
}
