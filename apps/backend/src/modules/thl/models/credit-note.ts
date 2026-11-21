import { model } from "@medusajs/framework/utils";

/**
 * GST Credit Note record for returns, cancellations, and order adjustments.
 * Table: credit_note.
 */
export const CreditNote = model.define("credit_note", {
  id: model.id({ prefix: "cn" }).primaryKey(),
  display_id: model.text().unique(),
  order_id: model.text(),
  return_request_id: model.text().nullable(),
  original_invoice_number: model.text(),
  reason: model.text(),
  currency_code: model.text().default("inr"),
  taxable_amount_paise: model.bigNumber(),
  cgst_paise: model.bigNumber().default(0),
  sgst_paise: model.bigNumber().default(0),
  igst_paise: model.bigNumber().default(0),
  total_tax_paise: model.bigNumber().default(0),
  total_amount_paise: model.bigNumber(),
  rate_percent: model.number().default(18),
  seller_gstin: model.text(),
  seller_legal_name: model.text(),
  seller_state_code: model.text(),
  buyer_state: model.text(),
  buyer_state_code: model.text(),
  buyer_gstin: model.text().nullable(),
  is_mock: model.boolean().default(false),
  status: model.text().default("issued"),
  metadata: model.json().nullable(),
  issued_at: model.dateTime(),
});
