import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

interface InspectionJoinRow {
  id: string;
  unit_serial: string;
  status: string;
  condition_grade: string;
  box_condition: string;
  turntable_media: unknown;
  detail_photos: unknown;
  checklist: unknown;
  notes: string | null;
  inspected_at: string | null;
  variant_id: string;
  variant_title: string;
  variant_sku: string | null;
  product_id: string;
  product_title: string;
  product_handle: string;
  product_thumbnail: string | null;
}

/**
 * GET /store/inspections/:unit_serial
 *
 * Truthful Inspection Report & 360° Turntable Asset Viewer (AI-03).
 * Decision D2: Backs "Verified" badges with concrete evidence.
 */
export async function GET(
  req: MedusaRequest & { params: { unit_serial: string } },
  res: MedusaResponse,
) {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const serial = req.params.unit_serial;

  const row = (await pg("condition_inspection as ci")
    .join("product_variant as pv", "pv.id", "ci.variant_id")
    .join("product as p", "p.id", "pv.product_id")
    .where("ci.unit_serial", serial)
    .whereNull("ci.deleted_at")
    .select(
      "ci.id",
      "ci.unit_serial",
      "ci.status",
      "ci.condition_grade",
      "ci.box_condition",
      "ci.turntable_media",
      "ci.detail_photos",
      "ci.checklist",
      "ci.notes",
      "ci.inspected_at",
      "pv.id as variant_id",
      "pv.title as variant_title",
      "pv.sku as variant_sku",
      "p.id as product_id",
      "p.title as product_title",
      "p.handle as product_handle",
      "p.thumbnail as product_thumbnail",
    )
    .first()) as InspectionJoinRow | undefined;

  if (!row) {
    res.status(404).json({
      type: "not_found",
      message: `Inspection record for unit serial '${serial}' was not found.`,
    });
    return;
  }

  // Parse JSON columns safely
  const turntableMedia =
    typeof row.turntable_media === "string"
      ? JSON.parse(row.turntable_media)
      : row.turntable_media ?? [];
  const detailPhotos =
    typeof row.detail_photos === "string"
      ? JSON.parse(row.detail_photos)
      : row.detail_photos ?? [];
  const checklist =
    typeof row.checklist === "string"
      ? JSON.parse(row.checklist)
      : row.checklist ?? {};

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.json({
    inspection: {
      id: row.id,
      unit_serial: row.unit_serial,
      status: row.status,
      condition_grade: row.condition_grade,
      box_condition: row.box_condition,
      turntable_media: turntableMedia,
      detail_photos: detailPhotos,
      checklist,
      notes: row.notes,
      inspected_at: row.inspected_at,
      product: {
        id: row.product_id,
        title: row.product_title,
        handle: row.product_handle,
        thumbnail: row.product_thumbnail,
      },
      variant: {
        id: row.variant_id,
        size: row.variant_title,
        sku: row.variant_sku,
      },
    },
  });
}
