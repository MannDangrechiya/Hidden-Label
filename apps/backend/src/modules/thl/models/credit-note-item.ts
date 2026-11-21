import { model } from "@medusajs/framework/utils";

/**
 * Line item on a GST credit note.
 * Table: credit_note_item.
 */
export const CreditNoteItem = model.define("credit_note_item", {
  id: model.id({ prefix: "cnitem" }).primaryKey(),
  credit_note_id: model.text(),
  order_item_id: model.text(),
  title: model.text(),
  hsn: model.text(),
  quantity: model.number().default(1),
  unit_price_paise: model.bigNumber(),
  taxable_amount_paise: model.bigNumber(),
  tax_amount_paise: model.bigNumber(),
  total_amount_paise: model.bigNumber(),
});
