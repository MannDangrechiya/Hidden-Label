import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedDatabase, type IsolatedDatabase } from "../../test/integration-db";
import { adjustStock } from "./stock-adjustment";

let iso: IsolatedDatabase;

const ITEM = "iitem_concurrency";
const LOCATION = "sloc_test";

beforeAll(async () => {
  iso = await createIsolatedDatabase();
  await iso.db("inventory_level").insert({
    id: "il_test",
    inventory_item_id: ITEM,
    location_id: LOCATION,
    stocked_quantity: 50,
    reserved_quantity: 0,
  });
}, 30_000);

afterAll(async () => {
  await iso?.dispose();
});

describe("Concurrent stock adjustments (BUG-05)", () => {
  it("serialises 40 concurrent +1/-1 adjustments without losing an update", async () => {
    const deltas: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      deltas.push(1);
      deltas.push(-1);
    }

    const outcomes = await Promise.all(
      deltas.map((delta) =>
        adjustStock(
          iso.db,
          { inventoryItemId: ITEM, locationId: LOCATION, delta, reason: "count_correction" },
          { actorId: "user_test" },
        ),
      ),
    );

    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);

    const level = await iso.db("inventory_level").where({ id: "il_test" }).first();
    expect(Number(level.stocked_quantity)).toBe(50);

    const auditRows = await iso.db("audit_event").where({
      action: "inventory.adjusted",
      entity_id: ITEM,
    });
    expect(auditRows).toHaveLength(40);
  }, 30_000);

  it("refuses to go negative under the row lock", async () => {
    const outcome = await adjustStock(
      iso.db,
      { inventoryItemId: ITEM, locationId: LOCATION, delta: -51, reason: "damaged" },
      { actorId: "user_test" },
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.status).toBe(422);

    const level = await iso.db("inventory_level").where({ id: "il_test" }).first();
    expect(Number(level.stocked_quantity)).toBe(50);
  }, 30_000);

  it("returns 404 for an unknown level and 400 for a zero delta", async () => {
    const missing = await adjustStock(
      iso.db,
      { inventoryItemId: "iitem_missing", locationId: LOCATION, delta: 1, reason: "sample" },
      { actorId: "user_test" },
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(404);

    const zero = await adjustStock(
      iso.db,
      { inventoryItemId: ITEM, locationId: LOCATION, delta: 0, reason: "sample" },
      { actorId: "user_test" },
    );
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.status).toBe(400);
  }, 30_000);
});
