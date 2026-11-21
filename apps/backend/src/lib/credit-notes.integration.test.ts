import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { generateCreditNote } from "./credit-notes";

describe("GST Credit Notes (Integration)", () => {
  let iso: IsolatedDatabase;

  beforeEach(async () => {
    iso = await createIsolatedDatabase();

    // Seed test order and shipping address
    await iso.db("order_address").insert({
      id: "ordaddr_cn_test_01",
      first_name: "Asha",
      last_name: "Rao",
      address_1: "Sindhu Bhavan Road",
      city: "Ahmedabad",
      province: "Gujarat",
      postal_code: "380054",
      phone: "+919876543210",
    });

    await iso.db("order").insert({
      id: "order_cn_test_01",
      display_id: 101,
      currency_code: "inr",
      email: "asha.rao@example.com",
      status: "pending",
      shipping_address_id: "ordaddr_cn_test_01",
      total: 23600.0, // ₹23,600 inclusive
    });
  });

  afterEach(async () => {
    await iso.dispose();
  });

  it("allocates sequential credit note numbers from credit_note_display_seq", async () => {
    const res1 = await generateCreditNote(iso.db, {
      orderId: "order_cn_test_01",
      reason: "cancellation",
      totalRefundPaise: 2360000,
    });

    expect(res1.creditNote.display_id).toBe("CN-THL-1001");
    expect(res1.creditNote.original_invoice_number).toBe("INV-THL-101");
    expect(res1.document.is_mock).toBe(true);
    expect(res1.document.statutory_warning).toContain("SANDBOX TEST DOCUMENT");

    // Second credit note for a different order gets next sequence
    await iso.db("order").insert({
      id: "order_cn_test_02",
      display_id: 102,
      currency_code: "inr",
      total: 10000.0,
    });

    const res2 = await generateCreditNote(iso.db, {
      orderId: "order_cn_test_02",
      reason: "cancellation",
      totalRefundPaise: 1000000,
    });

    expect(res2.creditNote.display_id).toBe("CN-THL-1002");
  });

  it("prevents duplicate credit note generation for the same RMA", async () => {
    const res1 = await generateCreditNote(iso.db, {
      orderId: "order_cn_test_01",
      returnRequestId: "rma_test_99",
      reason: "return_refund",
      totalRefundPaise: 1500000,
    });

    expect(res1.duplicate).toBe(false);

    const res2 = await generateCreditNote(iso.db, {
      orderId: "order_cn_test_01",
      returnRequestId: "rma_test_99",
      reason: "return_refund",
      totalRefundPaise: 1500000,
    });

    expect(res2.duplicate).toBe(true);
    expect(res2.creditNote.id).toBe(res1.creditNote.id);
  });
});
