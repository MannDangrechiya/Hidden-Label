import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { POST as publishInventory } from "./asks/[id]/publish-inventory/route";
import { POST as settleAsk } from "./asks/[id]/settle/route";
import { POST as bookConsultation } from "../../store/bespoke/consultations/route";
import { GET as getStoreFabrics } from "../../store/bespoke/fabrics/route";
import { POST as createFabric } from "../bespoke/fabrics/route";

let iso: IsolatedDatabase;

interface CapturedResponse {
  statusCode: number;
  body: Record<string, unknown> | null;
}

function makeResponse(capture: CapturedResponse): MedusaResponse {
  const res = {
    status(code: number) {
      capture.statusCode = code;
      return res;
    },
    json(payload: Record<string, unknown>) {
      capture.body = payload;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return res as unknown as MedusaResponse;
}

function makeRequest(
  actorId: string | undefined,
  actorType: "user" | "customer",
  params?: Record<string, string>,
  body?: Record<string, unknown>,
): MedusaRequest & { params: Record<string, string> } {
  return {
    params: params ?? {},
    body,
    auth_context: actorId ? { actor_id: actorId, actor_type: actorType } : undefined,
    scope: {
      resolve: (key: unknown) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION || String(key).toLowerCase().includes("pg")) {
          return iso.db;
        }
        return iso.db;
      },
    },
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest & { params: Record<string, string> };
}

beforeAll(async () => {
  iso = await createIsolatedDatabase();

  await iso.db("user").insert([
    { id: "user_ops", email: "ops@thehiddenlabel.com", metadata: JSON.stringify({ role: "operations" }) },
  ]);

  await iso.db("stock_location").insert({
    id: "loc_wh_settle",
    name: "Mumbai Consignment Depot",
  });

  // Seed sample resale ask in 'intake_received' state
  await iso.db("resale_ask").insert([
    {
      id: "ask_test_1",
      variant_id: "var_sneaker_10",
      seller_id: "seller_consignor_1",
      ask_price: 45000,
      condition_grade: "deadstock",
      box_condition: "perfect",
      status: "intake_received",
    },
  ]);
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Phase 7 & 8: Resale Settlement & Bespoke Atelier Extensions", () => {
  it("rejects inventory publishing if resale ask is not yet authenticated", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await publishInventory(
      makeRequest("user_ops", "user", { id: "ask_test_1" }, { location_id: "loc_wh_settle" }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(422);
    expect(capture.body?.type).toBe("invalid_state");
  });

  it("publishes consignment ask into catalog inventory once authenticated", async () => {
    // Advance status to authenticated
    await iso.db("resale_ask").where({ id: "ask_test_1" }).update({ status: "authenticated" });

    const capture: CapturedResponse = { statusCode: 200, body: null };
    await publishInventory(
      makeRequest("user_ops", "user", { id: "ask_test_1" }, { location_id: "loc_wh_settle" }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(200);
    expect(capture.body?.ok).toBe(true);

    // Verify inventory level credited
    const level = await iso.db("inventory_level").where({ location_id: "loc_wh_settle" }).first();
    expect(level.stocked_quantity).toBe(1);

    // Verify stock movement logged
    const sm = await iso.db("stock_movement").where({ reference_id: "ask_test_1" }).first();
    expect(sm).toBeDefined();
    expect(sm.delta).toBe(1);
    expect(sm.movement_type).toBe("manual_adjustment");
  });

  it("settles consignor ask with platform fee deduction and 7-day return hold", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await settleAsk(
      makeRequest("user_ops", "user", { id: "ask_test_1" }, {
        sold_amount_rupees: 45000,
        commission_rate: 0.10, // 10%
        payout_reference: "NEFT-HDFC-99182371",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(200);
    const s = capture.body?.settlement as Record<string, unknown>;
    expect(Number(s.sold_amount_rupees)).toBe(45000);
    expect(Number(s.commission_rupees)).toBe(4500);
    expect(Number(s.payout_amount_rupees)).toBe(40500);
    expect(s.status).toBe("disbursed");
    expect(s.payout_reference).toBe("NEFT-HDFC-99182371");

    // Verify ask status updated to settled
    const ask = await iso.db("resale_ask").where({ id: "ask_test_1" }).first();
    expect(ask.status).toBe("settled");
  });

  it("books a customer consultation appointment at the bespoke atelier", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    await bookConsultation(
      makeRequest("cust_atelier_vip", "customer", {}, {
        customer_name: "Aakash Ambani",
        customer_email: "aakash@example.com",
        customer_phone: "+91 98200 12345",
        scheduled_at: futureDate,
        service_type: "bespoke_fitting",
        notes: "3-piece bespoke tuxedo for charity gala",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(201);
    const b = capture.body?.booking as Record<string, unknown>;
    expect(b.customer_name).toBe("Aakash Ambani");
    expect(b.service_type).toBe("bespoke_fitting");
    expect(b.status).toBe("scheduled");
  });

  it("creates fabric swatch and lists it in public store catalogue", async () => {
    // Admin creates swatch
    const adminCapture: CapturedResponse = { statusCode: 200, body: null };
    await createFabric(
      makeRequest("user_ops", "user", {}, {
        name: "Super 180s Tasmanian Merino Wool",
        code: "FAB-LP-180-NVY",
        mill: "Loro Piana Italy",
        composition: "100% Tasmanian Wool",
        weight_gsm: 260,
        color: "Deep Navy",
        surcharge_tier: "ultra_luxury",
        surcharge_rupees: 45000,
      }),
      makeResponse(adminCapture),
    );
    expect(adminCapture.statusCode).toBe(201);

    // Public store fetches fabrics
    const storeCapture: CapturedResponse = { statusCode: 200, body: null };
    await getStoreFabrics(makeRequest(undefined, "customer"), makeResponse(storeCapture));
    expect(storeCapture.statusCode).toBe(200);

    const list = storeCapture.body?.fabrics as Array<Record<string, unknown>>;
    expect(list.length).toBeGreaterThanOrEqual(1);
    const fab = list.find((f) => f.code === "FAB-LP-180-NVY");
    expect(fab).toBeDefined();
    expect(fab?.mill).toBe("Loro Piana Italy");
    expect(Number(fab?.surcharge_rupees)).toBe(45000);
  });
});
