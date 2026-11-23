import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@thl/ui";
import { fetchAdminInspections } from "../../../lib/api/resale";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { InspectionTable } from "./inspection-table";

export const metadata: Metadata = { title: "Condition Inspections" };

/** A-18 — Physical unit inspection and condition verification queue (AI-03). */
export default async function InspectionsPage() {
  // Resale is a separately gated rollout; the nav hides it, this stops a direct URL visit.
  if (process.env.NEXT_PUBLIC_ENABLE_RESALE !== "true") notFound();

  let inspections;
  let canWrite = false;
  try {
    [inspections, canWrite] = await Promise.all([
      fetchAdminInspections(),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "operations")),
    ]);
  } catch (error) {
    const message =
      error instanceof BackendError ? error.message : "Could not load inspection queue.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-headline-lg">Condition Inspections</h1>
          <p className="font-sans text-body-sm text-muted">
            Authentication lab review queue, condition grading, and turntable asset management.
          </p>
        </div>
      </div>
      <InspectionTable initialInspections={inspections} canWrite={canWrite} />
    </div>
  );
}
