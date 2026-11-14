import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchInventory, fetchStockLocations } from "../../../lib/api/inventory";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { InventoryManager } from "./inventory-manager";

export const metadata: Metadata = { title: "Inventory" };

/** A-06 — inventory management. */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string }>;
}) {
  const { low } = await searchParams;
  const lowOnly = low === "true";

  let levels;
  let locations;
  let canWrite = false;
  try {
    [levels, locations, canWrite] = await Promise.all([
      fetchInventory(lowOnly),
      fetchStockLocations(),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "operations")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load inventory.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Inventory</h1>
      <InventoryManager levels={levels} locations={locations} canWrite={canWrite} lowOnly={lowOnly} />
    </div>
  );
}
