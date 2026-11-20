import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { processReturnAction } from "./returns";

/**
 * Route-level regressions for R-05 (return restock) and R-07 (stock location).
 *
 * The handler is called directly with a minimal request/response shim against a real PostgreSQL
 * schema, so the row locks, the `restocked_at` compare-and-set and the location lookup all run
 * as they do in production.
 */

let iso: IsolatedDatabase;

const LOGGER = { warn() {}, error() {}, info() {} };

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

async function stockedAt(locationId: string): Promise<number> {
  const level = await iso.db("inventory_level")
    .where({ inventory_item_id: "iitem_returns", location_id: locationId })
    .first();
  return Number(level.stocked_quantity);
}

/** One return for a 2-unit order line, plus an inventory level in both warehouses. */
async function seedReturn(
  returnId: string,
  orderId: string,
  displayId: string,
): Promise<void> {
  await iso.db("order_line_item").insert({
    id: `oli_${returnId}`,
    order_id: orderId,
    variant_id: "variant_returns",
    unit_price: "1500.00",
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
    order_item_id: `oli_${returnId}`,
    quantity: 2,
  });
}

beforeAll(async () => {
  iso = await createIsolatedDatabase();

  await iso.db("user").insert({
    id: "user_ops",
    email: "ops@example.test",
    metadata: JSON.stringify({ role: "operations" }),
  });

  await iso.db("stock_location").insert([
    { id: "sloc_a", name: "Warehouse A" },
    { id: "sloc_b", name: "Warehouse B" },
  ]);

  await iso.db("inventory_level").insert([
    {
      id: "il_a",
      inventory_item_id: "iitem_returns",
      location_id: "sloc_a",
      stocked_quantity: 10,
      reserved_quantity: 0,
    },
    {
      id: "il_b",
      inventory_item_id: "iitem_returns",
      location_id: "sloc_b",
      stocked_quantity: 10,
      reserved_quantity: 0,
    },
  ]);

  await iso.db("product_variant_inventory_item").insert({
    variant_id: "variant_returns",
    inventory_item_id: "iitem_returns",
  });

  await iso.db("fulfillment").insert({ id: "ful_returns", location_id: "sloc_b" });
  await iso.db("order_fulfillment").insert({
    order_id: "order_returns",
    fulfillment_id: "ful_returns",
  });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Receiving a return restocks exactly once (R-05)", () => {
  it("restocks only once when five receive requests race", async () => {
    await seedReturn("rma_race", "order_returns", "RMA-8001");
    const beforeA = await stockedAt("sloc_a");
    const beforeB = await stockedAt("sloc_b");

    const results = await Promise.all(Array.from({ length: 5 }, () => receive("rma_race")));

    const restocked = results.filter(
      (result) =>
        (result.body?.restock as { restocked?: boolean } | undefined)?.restocked === true,
    );
    expect(restocked).toHaveLength(1);
    expect(results.every((result) => result.statusCode === 200)).toBe(true);

    const already = results.filter(
      (result) =>
        (result.body?.restock as { reason?: string } | undefined)?.reason === "already_restocked",
    );
    expect(already).toHaveLength(4);

    // The order shipped from B, so B receives the units and A is untouched (R-07).
    expect(await stockedAt("sloc_b")).toBe(beforeB + 2);
    expect(await stockedAt("sloc_a")).toBe(beforeA);

    const request = await iso.db("return_request").where({ id: "rma_race" }).first();
    expect(request.status).toBe("received");
    expect(request.restocked_at).not.toBeNull();

    const inventoryAudits = await iso.db("audit_event").where({
      action: "inventory.adjusted",
      entity_id: "iitem_returns",
    });
    expect(inventoryAudits).toHaveLength(1);
  }, 30_000);

  it("does not add the units again when the received return is received twice", async () => {
    await seedReturn("rma_repeat", "order_returns", "RMA-8002");

    const first = await receive("rma_repeat");
    expect((first.body?.restock as { restocked?: boolean }).restocked).toBe(true);
    const afterFirst = await stockedAt("sloc_b");

    const second = await receive("rma_repeat");
    expect(second.statusCode).toBe(200);
    expect((second.body?.restock as { reason?: string }).reason).toBe("already_restocked");
    expect(second.body?.note).toBe(
      "Stock was already restocked for this return; nothing was added twice.",
    );

    expect(await stockedAt("sloc_b")).toBe(afterFirst);
  }, 30_000);

  it("refuses to guess a warehouse when several exist and the order records none", async () => {
    await seedReturn("rma_ambiguous", "order_no_fulfillment", "RMA-8003");
    const beforeA = await stockedAt("sloc_a");
    const beforeB = await stockedAt("sloc_b");

    const result = await receive("rma_ambiguous");

    expect(result.statusCode).toBe(422);
    expect(result.body?.type).toBe("location_required");
    expect(await stockedAt("sloc_a")).toBe(beforeA);
    expect(await stockedAt("sloc_b")).toBe(beforeB);

    const request = await iso.db("return_request").where({ id: "rma_ambiguous" }).first();
    expect(request.status).toBe("approved");
    expect(request.restocked_at).toBeNull();
  }, 30_000);

  it("restocks into an explicitly requested location over the order's own", async () => {
    await seedReturn("rma_explicit", "order_returns", "RMA-8004");
    const beforeA = await stockedAt("sloc_a");

    const result = await receive("rma_explicit", {
      action: "receive",
      condition: "resellable",
      location_id: "sloc_a",
    });

    expect(result.statusCode).toBe(200);
    expect((result.body?.restock as { locationId?: string }).locationId).toBe("sloc_a");
    expect(await stockedAt("sloc_a")).toBe(beforeA + 2);
  }, 30_000);

  it("never restocks a damaged return", async () => {
    await seedReturn("rma_damaged", "order_returns", "RMA-8005");
    const beforeB = await stockedAt("sloc_b");

    const result = await receive("rma_damaged", { action: "receive", condition: "damaged" });

    expect(result.statusCode).toBe(200);
    expect(result.body?.restock).toBeUndefined();
    expect(await stockedAt("sloc_b")).toBe(beforeB);

    const request = await iso.db("return_request").where({ id: "rma_damaged" }).first();
    expect(request.status).toBe("received");
    expect(request.restocked_at).toBeNull();
  }, 30_000);
});
