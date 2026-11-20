import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { restockReturn, ReturnAlreadyRestockedError, type RestockLine } from "./return-restock";

let iso: IsolatedDatabase;

const LOCATION = "sloc_restock";

beforeAll(async () => {
  iso = await createIsolatedDatabase();
  await iso.db("stock_location").insert({ id: LOCATION, name: "Restock Warehouse" });
  await iso.db("inventory_level").insert({
    id: "il_restock_a",
    inventory_item_id: "iitem_restock_a",
    location_id: LOCATION,
    stocked_quantity: 10,
    reserved_quantity: 0,
  });
  await iso.db("inventory_level").insert({
    id: "il_restock_b",
    inventory_item_id: "iitem_restock_b",
    location_id: LOCATION,
    stocked_quantity: 10,
    reserved_quantity: 0,
  });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

async function createReturn(id: string, displayId: string, orderId: string): Promise<void> {
  await iso.db("return_request").insert({ id, display_id: displayId, order_id: orderId });
}

/** One receive attempt: its own transaction, holding the return row lock like the route does. */
async function attemptRestock(
  returnRequestId: string,
  lines: RestockLine[],
  displayId = "RMA-TEST",
) {
  return iso.db.transaction(async (trx) => {
    await trx("return_request").where({ id: returnRequestId }).forUpdate().first("id");
    return restockReturn(trx, {
      returnRequestId,
      displayId,
      locationId: LOCATION,
      lines,
      audit: { actorId: "user_ops" },
    });
  });
}

async function stocked(inventoryItemId: string): Promise<number> {
  const level = await iso.db("inventory_level").where({ inventory_item_id: inventoryItemId }).first();
  return Number(level.stocked_quantity);
}

describe("Concurrent return restock (R-05)", () => {
  it("restocks a return once when five receives race on the same RMA", async () => {
    await createReturn("rma_race", "RMA-9001", "order_race");
    const before = await stocked("iitem_restock_a");

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        attemptRestock("rma_race", [{ inventoryItemId: "iitem_restock_a", quantity: 2 }], "RMA-9001"),
      ),
    );

    // Exactly one transaction wins the `restocked_at` compare-and-set; the rest roll back.
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(4);
    for (const result of rejected) {
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(ReturnAlreadyRestockedError);
    }

    expect(await stocked("iitem_restock_a")).toBe(before + 2);

    const request = await iso.db("return_request").where({ id: "rma_race" }).first();
    expect(request.restocked_at).not.toBeNull();

    const auditRows = await iso.db("audit_event").where({ entity_id: "iitem_restock_a" });
    expect(auditRows).toHaveLength(1);
  }, 30_000);

  it("never adds the same returned units twice on a repeated receive", async () => {
    await createReturn("rma_repeat", "RMA-9002", "order_repeat");

    const first = await attemptRestock(
      "rma_repeat",
      [{ inventoryItemId: "iitem_restock_a", quantity: 3 }],
      "RMA-9002",
    );
    expect(first.restocked).toBe(true);
    expect(first.units).toBe(3);
    const afterFirst = await stocked("iitem_restock_a");

    await expect(
      attemptRestock("rma_repeat", [{ inventoryItemId: "iitem_restock_a", quantity: 3 }], "RMA-9002"),
    ).rejects.toBeInstanceOf(ReturnAlreadyRestockedError);

    expect(await stocked("iitem_restock_a")).toBe(afterFirst);
  }, 30_000);

  it("composes concurrent restocks of different returns without losing an update", async () => {
    const before = await stocked("iitem_restock_b");

    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const id = `rma_parallel_${i}`;
      await createReturn(id, `RMA-91${i}`, `order_parallel_${i}`);
      ids.push(id);
    }

    const outcomes = await Promise.all(
      ids.map((id) =>
        attemptRestock(id, [{ inventoryItemId: "iitem_restock_b", quantity: 2 }], "RMA-PARALLEL"),
      ),
    );

    expect(outcomes.every((outcome) => outcome.restocked)).toBe(true);
    expect(outcomes.reduce((sum, outcome) => sum + outcome.units, 0)).toBe(12);
    expect(await stocked("iitem_restock_b")).toBe(before + 12);
  }, 30_000);

  it("leaves the return unmarked when no inventory level exists to receive into", async () => {
    await createReturn("rma_nolink", "RMA-9003", "order_nolink");

    const outcome = await attemptRestock(
      "rma_nolink",
      [{ inventoryItemId: "iitem_absent", quantity: 1 }],
      "RMA-9003",
    );

    expect(outcome.restocked).toBe(false);
    expect(outcome.reason).toBe("nothing_to_restock");
    expect(outcome.skipped).toHaveLength(1);

    const request = await iso.db("return_request").where({ id: "rma_nolink" }).first();
    expect(request.restocked_at).toBeNull();
  }, 30_000);
});
