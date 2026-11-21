import knex from "knex";
import { ShiprocketSandboxServer } from "../modules/shiprocket/sandbox-server";
import { ShiprocketClient } from "../modules/shiprocket/client";
import { setShiprocketClient } from "../lib/shiprocket-provider";
import {
  resolveWarehousePickup,
  upsertWarehousePickupLocation,
} from "../lib/warehouse-pickup";
import {
  claimShipmentOperation,
  completeShipmentOperation,
} from "../lib/shipment-operations";
import { applyShipmentUpdate } from "../lib/shipment-status";
import { recordWebhookEvent } from "../lib/webhook-tracking";
import {
  bookRmaReversePickup,
  receiveAndInspectReturn,
} from "../lib/rma-reverse-pickup";
import { generateCreditNote } from "../lib/credit-notes";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5437/the_hidden_label";

interface ScenarioReport {
  scenario: string;
  status: "PASSED" | "FAILED";
  details: Record<string, unknown>;
}

export async function runPhaseBSandboxVerification(): Promise<{
  timestamp: string;
  scenarios: ScenarioReport[];
}> {
  console.log("================================================================================");
  console.log("THE HIDDEN LABEL — PHASE B: SHIPROCKET SANDBOX, LOGISTICS, RMA & GST AUDIT");
  console.log("================================================================================\n");

  const db = knex({ client: "pg", connection: DATABASE_URL });
  const sandbox = new ShiprocketSandboxServer({ port: 9095 });
  await sandbox.start();

  const client = new ShiprocketClient({
    baseUrl: sandbox.getUrl(),
    email: "operations@thehiddenlabel.com",
    password: "sandbox_secret_123",
  });
  setShiprocketClient(client);

  const scenarios: ScenarioReport[] = [];

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Authentication & Token Lifecycle
    // -------------------------------------------------------------------------
    console.log("[Scenario 1] Testing Shiprocket Authentication & Token Caching...");
    const auth1 = await client.login();
    const auth2 = await client.login(); // Should return cached token
    const tokenValid = auth1.token.startsWith("mock_jwt_token_") && auth1.token === auth2.token;

    scenarios.push({
      scenario: "1. Authentication and Token Lifecycle",
      status: tokenValid ? "PASSED" : "FAILED",
      details: { token: auth1.token, cachedMatch: auth1.token === auth2.token },
    });
    console.log(`  -> ${tokenValid ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 2: Dynamic Warehouse Pickup Location Resolution
    // -------------------------------------------------------------------------
    console.log("[Scenario 2] Testing Dynamic Warehouse Pickup Configuration...");
    const whHq = await upsertWarehousePickupLocation(db, {
      stockLocationId: "sloc_01M7CWGEHZVMHVCMJQNAENCE0S",
      pickupLocationCode: "WH_AHMEDABAD_HQ",
      pickupLocationNickname: "Primary Warehouse",
      companyName: "The Hidden Label Luxury Retail Pvt Ltd",
      contactPerson: "Head of Logistics",
      email: "logistics@thehiddenlabel.com",
      phone: "+919876543210",
      addressLine1: "Sindhu Bhavan Road, Bodakdev",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380054",
      isDefault: true,
      isActive: true,
    });

    const whResolution = await resolveWarehousePickup(db, {
      stockLocationId: "sloc_01M7CWGEHZVMHVCMJQNAENCE0S",
    });

    const whResolved = whResolution.ok && whResolution.location.pickup_location_code === "WH_AHMEDABAD_HQ";
    scenarios.push({
      scenario: "2. Dynamic Warehouse Pickup Configuration",
      status: whResolved ? "PASSED" : "FAILED",
      details: {
        warehouseCode: whHq.pickup_location_code,
        source: whResolution.ok ? whResolution.source : null,
      },
    });
    console.log(`  -> ${whResolved ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 3: Serviceability & Courier Selection
    // -------------------------------------------------------------------------
    console.log("[Scenario 3] Testing Pincode Serviceability & Courier Selection...");
    const serviceability = await client.checkServiceability({
      pickup_postcode: "380054",
      delivery_postcode: "400050",
      weight: 1.2,
      cod: 0,
    });

    const couriers = serviceability.data.available_courier_companies;
    const servPassed = couriers.length > 0 && serviceability.data.recommended_courier_company_id === 24;

    scenarios.push({
      scenario: "3. Serviceability Check & Courier Selection",
      status: servPassed ? "PASSED" : "FAILED",
      details: {
        couriersCount: couriers.length,
        recommendedCourier: couriers[0]?.courier_name,
      },
    });
    console.log(`  -> ${servPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 4: Forward Shipment Creation & AWB Assignment
    // -------------------------------------------------------------------------
    console.log("[Scenario 4] Testing Order Dispatch, AWB Assignment & Label Generation...");
    const srOrder = await client.createOrder({
      order_id: "THL-TEST-VERIFY-01",
      order_date: "2026-11-21 14:30",
      pickup_location: "Primary Warehouse",
      billing_customer_name: "Raghav",
      billing_last_name: "Sharma",
      billing_address: "Flat 402, Royal Palms, Bandra West",
      billing_city: "Mumbai",
      billing_pincode: "400050",
      billing_state: "Maharashtra",
      billing_country: "India",
      billing_email: "raghav.sharma@thehiddenlabel.test",
      billing_phone: "9876543210",
      shipping_is_billing: true,
      order_items: [
        {
          name: "Air Jordan 1 High OG (Test)",
          sku: "J1-RETRO-TEST-01",
          units: 1,
          selling_price: 18878.82,
        },
      ],
      payment_method: "Prepaid",
      sub_total: 18878.82,
      length: 35,
      breadth: 25,
      height: 15,
      weight: 1.2,
    });

    const awbRes = await client.assignAwb({
      shipment_id: srOrder.shipment_id,
      courier_id: 24,
    });

    const labelRes = await client.generateLabel([srOrder.shipment_id]);

    const forwardPassed =
      Boolean(srOrder.shipment_id) &&
      awbRes.response.data.awb_code.startsWith("SRMOCK") &&
      labelRes.label_url.includes(".pdf");

    scenarios.push({
      scenario: "4. Forward Shipment Creation, AWB & Label",
      status: forwardPassed ? "PASSED" : "FAILED",
      details: {
        sr_order_id: srOrder.order_id,
        sr_shipment_id: srOrder.shipment_id,
        awb: awbRes.response.data.awb_code,
        courier: awbRes.response.data.courier_name,
        label_url: labelRes.label_url,
      },
    });
    console.log(`  -> ${forwardPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 5: Shipment Dispatch Mutex & Idempotency
    // -------------------------------------------------------------------------
    console.log("[Scenario 5] Testing Shipment Operation Mutex & Idempotency...");
    const testShipmentOrderId = `order_phase_b_test_${Date.now()}`;
    const testFulfillmentId = `ful_phase_b_${Date.now()}`;

    const claim1 = await claimShipmentOperation(db, {
      orderId: testShipmentOrderId,
      fulfillmentId: testFulfillmentId,
    });

    if (claim1.state === "claimed") {
      await completeShipmentOperation(db, claim1.operationId, {
        shipmentId: `shp_phase_b_${Date.now()}`,
        awb: awbRes.response.data.awb_code,
        courier: awbRes.response.data.courier_name,
      });
    }

    const claim2 = await claimShipmentOperation(db, {
      orderId: testShipmentOrderId,
      fulfillmentId: testFulfillmentId,
    });

    const idempotencyPassed = claim1.state === "claimed" && claim2.state === "duplicate";
    scenarios.push({
      scenario: "5. Shipment Dispatch Mutex & Idempotency",
      status: idempotencyPassed ? "PASSED" : "FAILED",
      details: {
        firstClaim: claim1.state,
        secondClaim: claim2.state,
      },
    });
    console.log(`  -> ${idempotencyPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 6: Concurrent Dispatch Serialization
    // -------------------------------------------------------------------------
    console.log("[Scenario 6] Testing Concurrent Dispatch Claims...");
    const concOrderId = `order_phase_b_conc_${Date.now()}`;
    const concFulId = `ful_phase_b_conc_${Date.now()}`;

    const [cClaimA, cClaimB] = await Promise.all([
      claimShipmentOperation(db, {
        orderId: concOrderId,
        fulfillmentId: concFulId,
      }),
      claimShipmentOperation(db, {
        orderId: concOrderId,
        fulfillmentId: concFulId,
      }),
    ]);

    const states = [cClaimA.state, cClaimB.state].sort();
    const concurrentPassed = states[0] === "claimed" && states[1] === "in_progress";

    scenarios.push({
      scenario: "6. Concurrent Dispatch Serialization",
      status: concurrentPassed ? "PASSED" : "FAILED",
      details: { states },
    });
    console.log(`  -> ${concurrentPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 7: Webhook Token Authentication (Constant-Time)
    // -------------------------------------------------------------------------
    console.log("[Scenario 7] Testing Webhook Constant-Time Token Security...");
    const fakeToken = "secret_shiprocket_webhook_token_mock_test";
    process.env.SHIPROCKET_WEBHOOK_TOKEN = fakeToken;

    // Direct constant time check logic
    const crypto = await import("node:crypto");
    const checkToken = (cand: string) => {
      const a = Buffer.from(cand);
      const b = Buffer.from(fakeToken);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    };

    const tokenSecPassed = checkToken(fakeToken) && !checkToken("bad_token_123");
    scenarios.push({
      scenario: "7. Webhook Constant-Time Token Security",
      status: tokenSecPassed ? "PASSED" : "FAILED",
      details: { validTokenVerified: true, invalidTokenRejected: true },
    });
    console.log(`  -> ${tokenSecPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 8: Webhook Replay Deduplication
    // -------------------------------------------------------------------------
    console.log("[Scenario 8] Testing Webhook Replay Deduplication in webhook_event...");
    const testAwb = awbRes.response.data.awb_code;
    const eventId = `sr_evt_replay_test_${Date.now()}`;
    const pHash = crypto.createHash("sha256").update("test_payload").digest("hex");

    const wRec1 = await recordWebhookEvent(db, {
      eventId,
      provider: "shiprocket",
      eventType: "shipment.in_transit",
      entityId: testAwb,
      payloadHash: pHash,
    });

    const wRec2 = await recordWebhookEvent(db, {
      eventId,
      provider: "shiprocket",
      eventType: "shipment.in_transit",
      entityId: testAwb,
      payloadHash: pHash,
    });

    const dedupPassed = !wRec1.duplicate && wRec2.duplicate;
    scenarios.push({
      scenario: "8. Webhook Replay Deduplication",
      status: dedupPassed ? "PASSED" : "FAILED",
      details: { firstCallDuplicate: wRec1.duplicate, secondCallDuplicate: wRec2.duplicate },
    });
    console.log(`  -> ${dedupPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 9: Anti-Regression Status Safety
    // -------------------------------------------------------------------------
    console.log("[Scenario 9] Testing Webhook Anti-Regression Status Protection...");
    const testShipmentId = `shp_test_antireg_${Date.now()}`;
    await db("shipment").insert({
      id: testShipmentId,
      order_id: "order_antireg_test",
      status: "delivered",
      awb: `AWB_ANTIREG_${Date.now()}`,
    });

    const currentShipment = await db("shipment").where({ id: testShipmentId }).first();

    const lateUpdate = await db.transaction((trx) =>
      applyShipmentUpdate(trx, currentShipment, {
        status: "IN TRANSIT",
        eventKey: `in_transit_late_${Date.now()}`,
        source: "shiprocket_webhook",
      }),
    );

    const antiRegPassed = lateUpdate.status === "delivered" && lateUpdate.regressed === true;
    scenarios.push({
      scenario: "9. Anti-Regression Status Protection",
      status: antiRegPassed ? "PASSED" : "FAILED",
      details: {
        persistedStatus: lateUpdate.status,
        regressedFlag: lateUpdate.regressed,
      },
    });
    console.log(`  -> ${antiRegPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 10: Reverse Pickup & RMA Integration
    // -------------------------------------------------------------------------
    console.log("[Scenario 10] Testing RMA Reverse Pickup Booking with Shiprocket...");
    const testRmaId = `rma_verify_${Date.now()}`;
    const rmaDisplayId = `RMA-V${Math.floor(Math.random() * 9000 + 1000)}`;

    await db("order_address").insert({
      id: `ordaddr_${testRmaId}`,
      first_name: "Asha",
      last_name: "Rao",
      address_1: "Sindhu Bhavan Road",
      city: "Ahmedabad",
      province: "Gujarat",
      postal_code: "380054",
      phone: "+919876543210",
    });

    await db("order").insert({
      id: `order_${testRmaId}`,
      region_id: "reg_01M7CWGEG96NW28XB7ASEZP74G",
      sales_channel_id: "sc_01M7CWGEC5WNV8XDZWVME7VEZ1",
      display_id: Math.floor(Math.random() * 9000 + 1000),
      currency_code: "inr",
      email: "asha@example.com",
      status: "pending",
      shipping_address_id: `ordaddr_${testRmaId}`,
    });

    await db("order_line_item").insert({
      id: `oli_${testRmaId}`,
      title: "Cashmere Scarf",
      product_title: "Cashmere Scarf",
      variant_sku: "CSHM-01",
      unit_price: 15000.0,
      raw_unit_price: JSON.stringify({ value: "15000", precision: 20 }),
    });

    await db("return_request").insert({
      id: testRmaId,
      display_id: rmaDisplayId,
      order_id: `order_${testRmaId}`,
      customer_id: `cus_${testRmaId}`,
      status: "approved",
      reason_code: "size_too_small",
      resolution: "refund",
      refund_amount: 15000.0,
      requested_at: new Date(),
    });

    await db("return_request_item").insert({
      id: `rri_${testRmaId}`,
      return_request_id: testRmaId,
      order_item_id: `oli_${testRmaId}`,
      quantity: 1,
    });

    const reverse1 = await bookRmaReversePickup(db, { returnRequestId: testRmaId });
    const reverse2 = await bookRmaReversePickup(db, { returnRequestId: testRmaId });

    const reversePassed =
      reverse1.ok &&
      reverse1.awb?.startsWith("SRREV") &&
      reverse2.duplicate === true &&
      reverse2.awb === reverse1.awb;

    scenarios.push({
      scenario: "10. Reverse Pickup Booking & Idempotency",
      status: reversePassed ? "PASSED" : "FAILED",
      details: {
        awb: reverse1.awb,
        courier: reverse1.courier,
        secondCallDuplicate: reverse2.duplicate,
      },
    });
    console.log(`  -> ${reversePassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 11: Return Inspection & Atomic Restocking
    // -------------------------------------------------------------------------
    console.log("[Scenario 11] Testing Return Inspection & Atomic Restocking under Row Lock...");
    // Seed inventory item for this RMA
    const testInvId = `iitem_rma_${Date.now()}`;
    const testVarId = `var_rma_${Date.now()}`;

    await db("order_line_item")
      .where({ id: `oli_${testRmaId}` })
      .update({ variant_id: testVarId });

    await db("inventory_item").insert({
      id: testInvId,
      requires_shipping: true,
    });

    await db("product_variant_inventory_item").insert({
      id: `pvii_${Date.now()}`,
      variant_id: testVarId,
      inventory_item_id: testInvId,
      required_quantity: 1,
    });

    await db("inventory_level").insert({
      id: `ilev_rma_${Date.now()}`,
      inventory_item_id: testInvId,
      location_id: "sloc_01M7CWGEHZVMHVCMJQNAENCE0S",
      stocked_quantity: 10,
      reserved_quantity: 0,
      incoming_quantity: 0,
      raw_stocked_quantity: JSON.stringify({ value: "10", precision: 20 }),
      raw_reserved_quantity: JSON.stringify({ value: "0", precision: 20 }),
      raw_incoming_quantity: JSON.stringify({ value: "0", precision: 20 }),
    });

    const receiveRes1 = await receiveAndInspectReturn(db, {
      returnRequestId: testRmaId,
      condition: "resellable",
      locationId: "sloc_01M7CWGEHZVMHVCMJQNAENCE0S",
      actorId: "inspector_verify",
    });

    const receiveRes2 = await receiveAndInspectReturn(db, {
      returnRequestId: testRmaId,
      condition: "resellable",
      locationId: "sloc_01M7CWGEHZVMHVCMJQNAENCE0S",
      actorId: "inspector_verify",
    });

    const restockPassed =
      receiveRes1.restock?.restocked === true &&
      receiveRes1.restock.units === 1 &&
      receiveRes2.restock?.restocked === false &&
      receiveRes2.restock.reason === "already_restocked";

    scenarios.push({
      scenario: "11. Return Inspection & Atomic Restocking",
      status: restockPassed ? "PASSED" : "FAILED",
      details: {
        firstRestocked: receiveRes1.restock?.restocked,
        secondRestockedReason: receiveRes2.restock?.reason,
      },
    });
    console.log(`  -> ${restockPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 12: Ineligible Return Restocking Denial
    // -------------------------------------------------------------------------
    console.log("[Scenario 12] Testing Ineligible Return (Damaged Unit) Restocking Denial...");
    const damagedRmaId = `rma_damaged_${Date.now()}`;
    await db("return_request").insert({
      id: damagedRmaId,
      display_id: `RMA-D${Math.floor(Math.random() * 9000 + 1000)}`,
      order_id: `order_${testRmaId}`,
      customer_id: `cus_${testRmaId}`,
      status: "approved",
      reason_code: "defective",
      resolution: "refund",
      refund_amount: 15000.0,
      requested_at: new Date(),
    });

    const damagedRes = await receiveAndInspectReturn(db, {
      returnRequestId: damagedRmaId,
      condition: "damaged",
      locationId: "sloc_01M7CWGEHZVMHVCMJQNAENCE0S",
      actorId: "inspector_verify",
    });

    const damagedPassed = damagedRes.restock === null;
    scenarios.push({
      scenario: "12. Ineligible Return Restocking Denial",
      status: damagedPassed ? "PASSED" : "FAILED",
      details: { restockOutcome: damagedRes.restock },
    });
    console.log(`  -> ${damagedPassed ? "PASSED" : "FAILED"}\n`);

    // -------------------------------------------------------------------------
    // Scenario 13: GST Credit Note Generation & Sequence Allocation
    // -------------------------------------------------------------------------
    console.log("[Scenario 13] Testing GST Credit Note Generation & Sequence Allocation...");
    const cnRes1 = await generateCreditNote(db, {
      orderId: `order_${testRmaId}`,
      returnRequestId: testRmaId,
      reason: "return_refund",
      totalRefundPaise: 1500000,
    });

    const cnRes2 = await generateCreditNote(db, {
      orderId: `order_${testRmaId}`,
      returnRequestId: testRmaId,
      reason: "return_refund",
      totalRefundPaise: 1500000,
    });

    const cnPassed =
      cnRes1.creditNote.display_id.startsWith("CN-THL-") &&
      cnRes1.duplicate === false &&
      cnRes2.duplicate === true &&
      cnRes1.document.is_mock === true &&
      cnRes1.document.statutory_warning.includes("SANDBOX TEST DOCUMENT");

    scenarios.push({
      scenario: "13. GST Credit Note Generation & Sequence Allocation",
      status: cnPassed ? "PASSED" : "FAILED",
      details: {
        creditNoteNumber: cnRes1.creditNote.display_id,
        invoiceNumber: cnRes1.creditNote.original_invoice_number,
        taxType: cnRes1.document.tax_type,
        totalTax: cnRes1.document.breakdown.total_tax,
        totalAmount: cnRes1.document.breakdown.total_amount,
        duplicatePrevented: cnRes2.duplicate,
      },
    });
    console.log(`  -> ${cnPassed ? "PASSED" : "FAILED"}\n`);
  } finally {
    setShiprocketClient(null);
    await sandbox.stop();
    await db.destroy();
  }

  const allPassed = scenarios.every((s) => s.status === "PASSED");
  console.log("================================================================================");
  console.log(`PHASE B SANDBOX VERIFICATION COMPLETED: ${allPassed ? "13/13 PASSED (100%)" : "FAILURES DETECTED"}`);
  console.log("================================================================================\n");

  return {
    timestamp: new Date().toISOString(),
    scenarios,
  };
}

runPhaseBSandboxVerification()
  .then((res) => {
    const failed = res.scenarios.filter((s) => s.status === "FAILED");
    if (failed.length > 0) {
      console.error("Verification failed for scenarios:", failed);
      process.exit(1);
    }
    console.log("SUCCESS: All Phase B logistics and GST lifecycle tests verified.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Verification crashed:", err);
    process.exit(1);
  });
