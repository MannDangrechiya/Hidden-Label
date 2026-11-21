import type { Knex } from "knex";
import { generateEntityId } from "@medusajs/framework/utils";
import { computeInclusiveGst, gstStateCode, hsnForProduct } from "./gst";
import { toPaise, toRupeesNumber } from "./money";
import { writeAudit } from "./audit";

export interface GenerateCreditNoteInput {
  orderId: string;
  returnRequestId?: string | null;
  reason: "return_refund" | "cancellation" | "price_adjustment";
  items?: Array<{
    orderItemId: string;
    quantity: number;
    title?: string;
    hsn?: string;
    unitPricePaise: number;
  }>;
  totalRefundPaise?: number;
  actorId?: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface CreditNoteRecord {
  id: string;
  display_id: string;
  order_id: string;
  return_request_id: string | null;
  original_invoice_number: string;
  reason: string;
  currency_code: string;
  taxable_amount_paise: string | number;
  cgst_paise: string | number;
  sgst_paise: string | number;
  igst_paise: string | number;
  total_tax_paise: string | number;
  total_amount_paise: string | number;
  rate_percent: number;
  seller_gstin: string;
  seller_legal_name: string;
  seller_state_code: string;
  buyer_state: string;
  buyer_state_code: string;
  buyer_gstin: string | null;
  is_mock: boolean;
  status: "issued" | "void";
  metadata: Record<string, unknown> | null;
  issued_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreditNoteDocument {
  title: string;
  is_mock: boolean;
  statutory_warning: string;
  credit_note_number: string;
  original_invoice_number: string;
  order_id: string;
  return_request_id: string | null;
  issued_at: string;
  seller: {
    legal_name: string;
    gstin: string;
    state_code: string;
    state_name: string;
    configured: boolean;
  };
  buyer: {
    state_name: string;
    state_code: string;
    gstin: string | null;
  };
  tax_type: "INTRA_STATE (CGST + SGST)" | "INTER_STATE (IGST)";
  breakdown: {
    taxable_amount: string;
    cgst_amount: string;
    sgst_amount: string;
    igst_amount: string;
    total_tax: string;
    total_amount: string;
    rate_percent: number;
  };
  items: Array<{
    title: string;
    hsn: string;
    quantity: number;
    unit_price: string;
    taxable_amount: string;
    tax_amount: string;
    total_amount: string;
  }>;
}

/**
 * Generates an atomic sequential GST credit note for an order return or cancellation.
 * Idempotent: If a credit note already exists for the given return request, returns the existing record.
 */
export async function generateCreditNote(
  pg: Knex,
  input: GenerateCreditNoteInput,
): Promise<{ creditNote: CreditNoteRecord; document: CreditNoteDocument; duplicate: boolean }> {
  // 1. Idempotency Check: Existing credit note for this RMA
  if (input.returnRequestId) {
    const existing = (await pg("credit_note")
      .where({ order_id: input.orderId, return_request_id: input.returnRequestId })
      .first()) as CreditNoteRecord | undefined;

    if (existing) {
      const doc = await renderCreditNoteDocument(pg, existing.id);
      return { creditNote: existing, document: doc, duplicate: true };
    }
  }

  // 2. Fetch original order, customer address, and line items
  const order = await pg("order")
    .where({ id: input.orderId })
    .whereNull("deleted_at")
    .first();

  if (!order) {
    throw new Error(`Order ${input.orderId} not found.`);
  }

  const shippingAddr = order.shipping_address_id
    ? await pg("order_address").where({ id: order.shipping_address_id }).first()
    : null;

  // 3. Statutory Seller Identity from environment
  const sellerStateCode = process.env.BUSINESS_STATE_CODE || "24";
  const sellerStateName = process.env.BUSINESS_STATE_NAME || "Gujarat";
  const sellerGstin = process.env.BUSINESS_GSTIN || "";
  const sellerLegalName =
    process.env.BUSINESS_LEGAL_NAME || "The Hidden Label Luxury Retail Pvt Ltd";
  const isSellerConfigured = Boolean(process.env.BUSINESS_GSTIN && process.env.BUSINESS_LEGAL_NAME);

  // 4. Buyer Place of Supply
  const buyerStateName = shippingAddr?.province || sellerStateName;
  const buyerStateCode = gstStateCode(buyerStateName) || sellerStateCode;

  // 5. Gather or derive Credit Note items & totals in integer paise
  let itemsToCredit: Array<{
    orderItemId: string;
    title: string;
    hsn: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }> = [];

  if (input.items && input.items.length > 0) {
    itemsToCredit = input.items.map((it) => ({
      orderItemId: it.orderItemId,
      title: it.title || "Returned Luxury Merchandise",
      hsn: it.hsn || hsnForProduct(it.title || "luxury apparel"),
      quantity: it.quantity,
      unitPricePaise: it.unitPricePaise,
      totalPaise: it.unitPricePaise * it.quantity,
    }));
  } else if (input.returnRequestId) {
    const rmaItems = await pg("return_request_item as rri")
      .join("order_line_item as oli", "oli.id", "rri.order_item_id")
      .where("rri.return_request_id", input.returnRequestId)
      .select(
        "rri.order_item_id",
        "oli.product_title",
        "rri.quantity",
        "oli.unit_price",
        "oli.metadata as item_metadata",
      );

    itemsToCredit = rmaItems.map((r: { order_item_id: string; product_title?: string; quantity: number; unit_price?: number; item_metadata?: Record<string, unknown> }) => {
      const pricePaise = toPaise(r.unit_price ?? 0);
      const qty = Number(r.quantity) || 1;
      const title = r.product_title || "Luxury Item";
      const hsn =
        typeof r.item_metadata?.hsn === "string" ? r.item_metadata.hsn : hsnForProduct(title);

      return {
        orderItemId: r.order_item_id,
        title,
        hsn,
        quantity: qty,
        unitPricePaise: pricePaise,
        totalPaise: pricePaise * qty,
      };
    });
  }

  // Derive total amount in paise
  const calculatedPaise = itemsToCredit.reduce((sum, it) => sum + it.totalPaise, 0);
  const totalAmountPaise = input.totalRefundPaise !== undefined
    ? input.totalRefundPaise
    : calculatedPaise > 0
      ? calculatedPaise
      : toPaise(order.total ?? 0);

  // 6. GST Breakdown Calculation
  const totalRupees = toRupeesNumber(totalAmountPaise);
  const gstBreakdown = computeInclusiveGst({
    totalInclusive: totalRupees,
    sellerStateCode,
    buyerState: buyerStateName,
    fallbackRatePercent: 18,
  });

  const taxablePaise = toPaise(gstBreakdown.taxable);
  const cgstPaise = toPaise(gstBreakdown.cgst);
  const sgstPaise = toPaise(gstBreakdown.sgst);
  const igstPaise = toPaise(gstBreakdown.igst);
  const totalTaxPaise = toPaise(gstBreakdown.totalTax);

  // 7. Atomic Sequential Credit Note Number Allocation
  const isMock = process.env.NODE_ENV !== "production" || !isSellerConfigured;

  return pg.transaction(async (trx) => {
    const seqResult = await trx.raw("SELECT nextval('credit_note_display_seq') as seq");
    const seqNum = seqResult.rows[0].seq;
    const displayId = `CN-THL-${seqNum}`;
    const originalInvoiceNumber = `INV-THL-${order.display_id}`;
    const id = generateEntityId(undefined, "cn");

    const [creditNote] = (await trx("credit_note")
      .insert({
        id,
        display_id: displayId,
        order_id: input.orderId,
        return_request_id: input.returnRequestId ?? null,
        original_invoice_number: originalInvoiceNumber,
        reason: input.reason,
        currency_code: "inr",
        taxable_amount_paise: taxablePaise,
        cgst_paise: cgstPaise,
        sgst_paise: sgstPaise,
        igst_paise: igstPaise,
        total_tax_paise: totalTaxPaise,
        total_amount_paise: totalAmountPaise,
        rate_percent: gstBreakdown.ratePercent,
        seller_gstin: sellerGstin,
        seller_legal_name: sellerLegalName,
        seller_state_code: sellerStateCode,
        buyer_state: buyerStateName,
        buyer_state_code: buyerStateCode,
        buyer_gstin: null,
        is_mock: isMock,
        status: "issued",
        metadata: JSON.stringify({
          intra_state: gstBreakdown.intraState,
          seller_configured: isSellerConfigured,
        }),
        issued_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*")) as CreditNoteRecord[];

    // Insert Credit Note line items
    for (const item of itemsToCredit) {
      const itemTotalPaise = item.totalPaise;
      const itemGst = computeInclusiveGst({
        totalInclusive: toRupeesNumber(itemTotalPaise),
        sellerStateCode,
        buyerState: buyerStateName,
        fallbackRatePercent: gstBreakdown.ratePercent,
      });

      await trx("credit_note_item").insert({
        id: generateEntityId(undefined, "cnitem"),
        credit_note_id: id,
        order_item_id: item.orderItemId,
        title: item.title,
        hsn: item.hsn,
        quantity: item.quantity,
        unit_price_paise: item.unitPricePaise,
        taxable_amount_paise: toPaise(itemGst.taxable),
        tax_amount_paise: toPaise(itemGst.totalTax),
        total_amount_paise: itemTotalPaise,
        created_at: new Date(),
      });
    }

    // Write audit event
    await writeAudit(trx, {
      actorType: input.actorId ? "admin" : "system",
      actorId: input.actorId || "credit_note_service",
      action: "credit_note.issued",
      entityType: "credit_note",
      entityId: id,
      summary: `GST Credit Note ${displayId} issued for Order THL-${order.display_id} (₹${toRupeesNumber(totalAmountPaise)})`,
      changes: {
        display_id: displayId,
        order_id: input.orderId,
        return_request_id: input.returnRequestId,
        total_amount_paise: totalAmountPaise,
        is_mock: isMock,
      },
      ip: input.ip,
      userAgent: input.userAgent,
    });

    const doc = await renderCreditNoteDocument(trx, id);
    return { creditNote, document: doc, duplicate: false };
  });
}

/**
 * Renders the printable / serializable credit note document structure.
 */
export async function renderCreditNoteDocument(
  pg: Knex,
  creditNoteId: string,
): Promise<CreditNoteDocument> {
  const cn = (await pg("credit_note").where({ id: creditNoteId }).first()) as
    | CreditNoteRecord
    | undefined;

  if (!cn) {
    throw new Error(`Credit note ${creditNoteId} not found.`);
  }

  const items = await pg("credit_note_item")
    .where({ credit_note_id: creditNoteId })
    .orderBy("created_at", "asc");

  const isIntraState = cn.seller_state_code === cn.buyer_state_code;
  const sellerConfigured = Boolean(cn.seller_gstin && cn.seller_gstin.trim());

  return {
    title: "GST CREDIT NOTE",
    is_mock: cn.is_mock,
    statutory_warning: cn.is_mock
      ? "**SANDBOX TEST DOCUMENT — NOT A LEGAL TAX DOCUMENT**"
      : "ORIGINAL FOR RECIPIENT — ISSUED UNDER SECTION 34 OF CGST ACT, 2017",
    credit_note_number: cn.display_id,
    original_invoice_number: cn.original_invoice_number,
    order_id: cn.order_id,
    return_request_id: cn.return_request_id,
    issued_at: new Date(cn.issued_at).toISOString(),
    seller: {
      legal_name: cn.seller_legal_name,
      gstin: cn.seller_gstin || "NOT CONFIGURED (SANDBOX TEST)",
      state_code: cn.seller_state_code,
      state_name: process.env.BUSINESS_STATE_NAME || "Gujarat",
      configured: sellerConfigured,
    },
    buyer: {
      state_name: cn.buyer_state,
      state_code: cn.buyer_state_code,
      gstin: cn.buyer_gstin,
    },
    tax_type: isIntraState ? "INTRA_STATE (CGST + SGST)" : "INTER_STATE (IGST)",
    breakdown: {
      taxable_amount: (Number(cn.taxable_amount_paise) / 100).toFixed(2),
      cgst_amount: (Number(cn.cgst_paise) / 100).toFixed(2),
      sgst_amount: (Number(cn.sgst_paise) / 100).toFixed(2),
      igst_amount: (Number(cn.igst_paise) / 100).toFixed(2),
      total_tax: (Number(cn.total_tax_paise) / 100).toFixed(2),
      total_amount: (Number(cn.total_amount_paise) / 100).toFixed(2),
      rate_percent: Number(cn.rate_percent),
    },
    items: items.map((it: { title: string; hsn: string; quantity: number; unit_price_paise: string | number; taxable_amount_paise: string | number; tax_amount_paise: string | number; total_amount_paise: string | number }) => ({
      title: it.title,
      hsn: it.hsn,
      quantity: it.quantity,
      unit_price: (Number(it.unit_price_paise) / 100).toFixed(2),
      taxable_amount: (Number(it.taxable_amount_paise) / 100).toFixed(2),
      tax_amount: (Number(it.tax_amount_paise) / 100).toFixed(2),
      total_amount: (Number(it.total_amount_paise) / 100).toFixed(2),
    })),
  };
}
