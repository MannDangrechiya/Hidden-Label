import "server-only";
import { backendFetch } from "../backend";
import { ADJUST_REASONS, type AdjustReason } from "../constants";

export { ADJUST_REASONS };
export type { AdjustReason };

export interface InventoryLevel {
  id: string;
  inventory_item_id: string;
  location_id: string;
  stocked_quantity: number;
  reserved_quantity: number;
  available: number;
  sku: string | null;
  item_title: string | null;
  variant_id: string | null;
  variant_title: string | null;
  product_id: string | null;
  product_title: string | null;
}

/** GET /admin/inventory?low=true — backs A-06. */
export async function fetchInventory(low = false): Promise<InventoryLevel[]> {
  const { levels } = await backendFetch<{ levels: InventoryLevel[] }>(
    `/admin/inventory${low ? "?low=true" : ""}`,
  );
  return levels;
}

export async function adjustInventory(input: {
  inventory_item_id: string;
  location_id: string;
  delta: number;
  reason: AdjustReason;
}): Promise<{ level: InventoryLevel; available: number }> {
  return backendFetch("/admin/inventory", { method: "POST", body: input });
}

export interface StockLocation {
  id: string;
  name: string;
}

/** Native Medusa resource, used to populate the location picker on the adjustment form. */
export async function fetchStockLocations(): Promise<StockLocation[]> {
  const { stock_locations } = await backendFetch<{ stock_locations: StockLocation[] }>(
    "/admin/stock-locations?limit=100",
  );
  return stock_locations;
}
