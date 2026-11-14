import { model } from "@medusajs/framework/utils";

/**
 * Condition inspection record (AI-03 360° Inspection Viewer & Verification).
 * Table: condition_inspection (docs/PHASE_5.5_PLAN.md §2.3)
 */
export const ConditionInspection = model.define("condition_inspection", {
  id: model.id({ prefix: "ins" }).primaryKey(),
  variant_id: model.text(),
  unit_serial: model.text().unique().nullable(),
  inspector_id: model.text().nullable(),
  status: model.text().default("pending"),
  condition_grade: model.text(),
  box_condition: model.text().default("perfect"),
  turntable_media: model.json(),
  detail_photos: model.json(),
  checklist: model.json(),
  notes: model.text().nullable(),
  inspected_at: model.dateTime().nullable(),
});
