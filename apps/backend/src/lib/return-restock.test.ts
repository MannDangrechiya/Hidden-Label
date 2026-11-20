import { describe, expect, it } from "vitest";
import { mergeRestockLines } from "./return-restock";

/**
 * R-05: several return lines can resolve to the same inventory item. They must become one
 * locked increment, or two updates would compete for the same `inventory_level` row.
 */
describe("Return restock line merging (R-05)", () => {
  it("sums quantities that map to the same inventory item", () => {
    const merged = mergeRestockLines([
      { inventoryItemId: "iitem_a", quantity: 1 },
      { inventoryItemId: "iitem_b", quantity: 2 },
      { inventoryItemId: "iitem_a", quantity: 3 },
    ]);

    expect(merged).toEqual([
      { inventoryItemId: "iitem_a", quantity: 4 },
      { inventoryItemId: "iitem_b", quantity: 2 },
    ]);
  });

  it("sorts by inventory item so lock order is deterministic", () => {
    const merged = mergeRestockLines([
      { inventoryItemId: "iitem_z", quantity: 1 },
      { inventoryItemId: "iitem_a", quantity: 1 },
    ]);

    expect(merged.map((line) => line.inventoryItemId)).toEqual(["iitem_a", "iitem_z"]);
  });

  it("drops lines without an inventory item or a positive integer quantity", () => {
    const merged = mergeRestockLines([
      { inventoryItemId: "", quantity: 2 },
      { inventoryItemId: "iitem_a", quantity: 0 },
      { inventoryItemId: "iitem_a", quantity: -1 },
      { inventoryItemId: "iitem_a", quantity: 1.5 },
    ]);

    expect(merged).toEqual([]);
  });
});
