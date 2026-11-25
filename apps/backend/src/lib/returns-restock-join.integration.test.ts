import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { processReturnAction } from "./returns";

/**
 * D1 regression: `return_request_item.order_item_id` stores Medusa's per-version `order_item`
 * ids (`orditem_...`), not `order_line_item` ids. The restock join must be the two-hop path
 * return_request_item → order_item.item_id → order_line_item.variant_id. Joining the line item
 * directly on `order_item_id` (the original bug) resolved `variant_id` to null, so a resellable
 * receive added no stock, wrote no stock_movement and left `restocked_at` null — exactly what
 * happened to RMA-1003 live.
 *
 * The handler is called directly with a minimal request/response shim against a real PostgreSQL
 * schema, as in returns.integration.test.ts.
 */

let iso: IsolatedDatabase;

const LOGGER = { warn() {}, error() {}, info() {} };

const LOCATION = "sloc_join";
const VARIANT = "variant_join";
const ITEM = "iitem_join";

interface Captured {
  statusCode: number;
  body: Record<string, unknown> | null;
}

function makeResponse(capture: Captured): MedusaResponse {
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

function makeRequest(body: Record<string, unknown>): MedusaRequest {
  return {
    body,
    auth_context: { actor_id: "user_ops", actor_type: "user" },
    scope: {
      resolve(key: string) {
        return key === ContainerRegistrationKeys.PG_CONNECTION ? iso.db : LOGGER;
      },
    },
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
  } as unknown as MedusaRequest;
}

async function receive(
  returnId: string,
  body: Record<string, unknown> = { action: "receive", condition: "resellable" },
): Promise<Captured> {
  const capture: Captured = { statusCode: 200, body: null };
  await processReturnAction(makeRequest(body), makeResponse(capture), returnId);
  return capture;
}

/**
 * The RMA-1003 shape: the RMA stores an `orditem_...` id, which points at the order line via
 * `order_item.item_id`; the order line carries the variant, which is linked to the inventory
 * item the stock actually sits on.
 */
async function seedOrderItemReturn(
  returnId: string,
  orderId: string,
  displayId: string,
): Promise<void> {
  await iso.db("order_line_item").insert({
    id: `oli_${returnId}`,
    order_id: orderId,
    variant_id: VARIANT,
    unit_price: "1500.00",
  });
  await iso.db("order_item").insert({
    id: `orditem_${returnId}`,
    order_id: orderId,
    item_id: `oli_${returnId}`,
    quantity: 1,
  });
  await iso.db("return_request").insert({
    id: returnId,
    display_id: displayId,
    order_id: orderId,
    status: "approved",
  });
  await iso.db("return_request_item").insert({
    id: `rri_${returnId}`,
    return_request_id: returnId,
    order_item_id: `orditem_${returnId}`,
    quantity: 1,
  });
}

async function stocked(): Promise<number> {
  const level = await iso.db("inventory_level")
    .where({ inventory_item_id: ITEM, location_id: LOCATION })
    .first();
  return Number(level.stocked_quantity);
}

beforeAll(async () => {
  iso = await createIsolatedDatabase();

  await iso.db("user").insert({
    id: "user_ops",
    email: "ops@example.test",
    metadata: JSON.stringify({ role: "operations" }),
  });

  await iso.db("stock_location").insert({ id: LOCATION, name: "Join Warehouse" });

  await iso.db("inventory_level").insert({
    id: "il_join",
    inventory_item_id: ITEM,
    location_id: LOCATION,
    stocked_quantity: 10,
    reserved_quantity: 0,
  });

  await iso.db("product_variant_inventory_item").insert({
    variant_id: VARIANT,
    inventory_item_id: ITEM,
  });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Restock join resolves the variant through order_item (D1)", () => {
  it("restocks a resellable receive that stores an orditem_ id", async () => {
    await seedOrderItemReturn("rma_join", "order_join", "RMA-JOIN-1");
    const before = await stocked();

    const result = await receive("rma_join");

    expect(result.statusCode).toBe(200);
    expect((result.body?.restock as { restocked?: boolean }).restocked).toBe(true);

    expect(await stocked()).toBe(before + 1);

    const request = await iso.db("return_request").where({ id: "rma_join" }).first();
    expect(request.restocked_at).not.toBeNull();

    const movements = await iso.db("stock_movement").where({
      inventory_item_id: ITEM,
      movement_type: "return_restock",
      reference_id: "rma_join",
    });
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].delta)).toBe(1);
    expect(Number(movements[0].balance_after)).toBe(before + 1);
  }, 30_000);

  it("replays the receive idempotently without double-restocking", async () => {
    await seedOrderItemReturn("rma_join_repeat", "order_join_repeat", "RMA-JOIN-2");
    const before = await stocked();

    const first = await receive("rma_join_repeat");
    expect((first.body?.restock as { restocked?: boolean }).restocked).toBe(true);
    const afterFirst = await stocked();

    const second = await receive("rma_join_repeat");
    expect(second.statusCode).toBe(200);
    expect((second.body?.restock as { reason?: string }).reason).toBe("already_restocked");

    expect(await stocked()).toBe(afterFirst);
    expect(afterFirst).toBe(before + 1);

    const movements = await iso.db("stock_movement").where({
      inventory_item_id: ITEM,
      movement_type: "return_restock",
      reference_id: "rma_join_repeat",
    });
    expect(movements).toHaveLength(1);
  }, 30_000);
});
