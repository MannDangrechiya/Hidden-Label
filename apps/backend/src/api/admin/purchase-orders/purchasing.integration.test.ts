import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../../../test/integration-db";
import { POST as postSuppliers } from "../suppliers/route";
import { POST as postPos } from "./route";
import { POST as receivePo } from "./[id]/receive/route";
import { GET as getMovements } from "../stock-movements/route";

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

function makeAdminRequest(
  actorId: string | undefined,
  params?: Record<string, string>,
  body?: Record<string, unknown>,
): MedusaRequest & { params: Record<string, string> } {
  return {
    params: params ?? {},
    body,
    auth_context: actorId ? { actor_id: actorId, actor_type: "user" } : undefined,
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
    { id: "user_ro", email: "ro@thehiddenlabel.com", metadata: JSON.stringify({ role: "readonly" }) },
  ]);

  await iso.db("stock_location").insert({
    id: "loc_wh_1",
    name: "Main Atelier Warehouse Mumbai",
  });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Phase 6: Retail Back Office, POs & Stock Movement Ledger", () => {
  let createdSupplierId: string;
  let createdPoId: string;
  let createdItemId: string;

  it("denies unauthenticated supplier requests with 401", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await postSuppliers(makeAdminRequest(undefined, {}, { name: "Test" }), makeResponse(capture));
    expect(capture.statusCode).toBe(401);
  });

  it("creates a luxury supplier record", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await postSuppliers(
      makeAdminRequest("user_ops", {}, {
        name: "Loro Piana Mill SpA",
        contact_email: "orders@loropiana.com",
        contact_phone: "+39 015 7711",
        gstin: "27AAACL1234F1Z5",
        address: "Quarona, Italy",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(201);
    const sup = capture.body?.supplier as Record<string, unknown>;
    expect(sup.name).toBe("Loro Piana Mill SpA");
    createdSupplierId = sup.id as string;
  });

  it("creates a purchase order with items", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await postPos(
      makeAdminRequest("user_ops", {}, {
        supplier_id: createdSupplierId,
        items: [
          {
            product_id: "prod_cashmere",
            variant_id: "var_cashmere_m",
            quantity: 20,
            unit_cost_rupees: 15000,
          },
        ],
        notes: "Fall/Winter Capsule Restock",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(201);
    const po = capture.body?.purchase_order as Record<string, unknown>;
    expect(po.display_id).toMatch(/^PO-THL-\d+$/);
    expect(Number(po.total_cost_rupees)).toBe(300000);
    expect(po.status).toBe("ordered");

    createdPoId = po.id as string;
    const items = capture.body?.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    createdItemId = items[0].id as string;
  });

  it("rejects over-receipt when quantity exceeds order line", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await receivePo(
      makeAdminRequest("user_ops", { id: createdPoId }, {
        location_id: "loc_wh_1",
        items: [{ item_id: createdItemId, quantity_to_receive: 25 }],
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(422);
    expect(capture.body?.type).toBe("over_receipt");
  });

  it("receives goods against PO, updates stock, logs immutable stock movement and creates GRN", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await receivePo(
      makeAdminRequest("user_ops", { id: createdPoId }, {
        location_id: "loc_wh_1",
        items: [{ item_id: createdItemId, quantity_to_receive: 12 }],
        notes: "Air Freight Batch 1 Delivered",
      }),
      makeResponse(capture),
    );

    expect(capture.statusCode).toBe(200);
    const po = capture.body?.purchase_order as Record<string, unknown>;
    expect(po.status).toBe("partially_received");

    const grn = capture.body?.goods_receipt as Record<string, unknown>;
    expect(grn.display_id).toMatch(/^GRN-THL-\d+$/);

    // Verify stock_movement entry in database (P6-04)
    const movements = await iso.db("stock_movement").where({ reference_id: createdPoId });
    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toBe("po_receipt");
    expect(movements[0].delta).toBe(12);
    expect(movements[0].balance_after).toBe(12);

    // Verify inventory_level in database
    const level = await iso.db("inventory_level").where({ location_id: "loc_wh_1" }).first();
    expect(level.stocked_quantity).toBe(12);
  });

  it("lists centralized stock movements in audit ledger", async () => {
    const capture: CapturedResponse = { statusCode: 200, body: null };
    await getMovements(makeAdminRequest("user_ops"), makeResponse(capture));

    expect(capture.statusCode).toBe(200);
    const list = capture.body?.stock_movements as Array<Record<string, unknown>>;
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].movement_type).toBe("po_receipt");
  });
});
