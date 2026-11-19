import { PACKAGE_BY_CATEGORY } from "./hsn";

/**
 * GAP-LOG-02: Shiprocket was always handed 30×20×12 cm and 0.6 kg, whatever the parcel.
 * Dimensions now come from the product's own `package_*` metadata when present, else from
 * its category, and the chargeable weight is the greater of actual and volumetric
 * (L×B×H / 5000, the courier convention for centimetres).
 */
export interface PackageItem {
  quantity: number;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PackageDims {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
}

function numberFrom(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function itemDims(item: PackageItem) {
  const fallback = PACKAGE_BY_CATEGORY[item.category ?? ""] ?? PACKAGE_BY_CATEGORY.ready_to_wear;
  const meta = item.metadata ?? {};
  return {
    length: numberFrom(meta.package_length_cm, fallback.length),
    breadth: numberFrom(meta.package_breadth_cm, fallback.breadth),
    height: numberFrom(meta.package_height_cm, fallback.height),
    weight: numberFrom(meta.package_weight_kg, fallback.weight),
  };
}

export function computePackage(items: PackageItem[]): PackageDims {
  if (items.length === 0) {
    const fallback = PACKAGE_BY_CATEGORY.ready_to_wear;
    return {
      lengthCm: fallback.length,
      breadthCm: fallback.breadth,
      heightCm: fallback.height,
      actualWeightKg: fallback.weight,
      volumetricWeightKg: round2((fallback.length * fallback.breadth * fallback.height) / 5000),
      chargeableWeightKg: Math.max(
        fallback.weight,
        round2((fallback.length * fallback.breadth * fallback.height) / 5000),
      ),
    };
  }

  let length = 0;
  let breadth = 0;
  let height = 0;
  let actualWeight = 0;

  for (const item of items) {
    const dims = itemDims(item);
    // Box footprint is driven by the largest item; heights stack up to a sane 60 cm cap.
    length = Math.max(length, dims.length);
    breadth = Math.max(breadth, dims.breadth);
    height = Math.min(60, height + dims.height * Math.max(1, item.quantity));
    actualWeight += dims.weight * Math.max(1, item.quantity);
  }

  const volumetric = round2((length * breadth * height) / 5000);

  return {
    lengthCm: Math.ceil(length),
    breadthCm: Math.ceil(breadth),
    heightCm: Math.ceil(height),
    actualWeightKg: round2(actualWeight),
    volumetricWeightKg: volumetric,
    chargeableWeightKg: Math.max(round2(actualWeight), volumetric),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
