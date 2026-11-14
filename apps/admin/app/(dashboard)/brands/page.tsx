import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchBrands } from "../../../lib/api/brands";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { BrandManager } from "./brand-manager";

export const metadata: Metadata = { title: "Brands" };

/** A-04 — brand management. */
export default async function BrandsPage() {
  let brands;
  let canWrite = false;
  try {
    [brands, canWrite] = await Promise.all([
      fetchBrands(),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "manager")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load brands.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-headline-lg">Brands</h1>
      <BrandManager brands={brands} canWrite={canWrite} />
    </div>
  );
}
