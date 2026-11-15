import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchAdminFitRules } from "../../../lib/api/resale";
import { fetchCurrentAdmin, roleAtLeast } from "../../../lib/api/auth";
import { BackendError } from "../../../lib/backend";
import { FitRulesManager } from "./fit-rules-manager";

export const metadata: Metadata = { title: "Fit Studio Rules" };

/** A-20 — Fit Studio silhouette sizing rules. */
export default async function FitRulesPage() {
  let rules;
  let canWrite = false;
  try {
    [rules, canWrite] = await Promise.all([
      fetchAdminFitRules(),
      fetchCurrentAdmin().then((a) => roleAtLeast(a.role, "manager")),
    ]);
  } catch (error) {
    const message = error instanceof BackendError ? error.message : "Could not load fit rules.";
    return <ErrorState message={message} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-headline-lg">Fit Studio Rules</h1>
        <p className="font-sans text-body-sm text-muted">
          Silhouette conversion deltas and personalized customer sizing guidance notes.
        </p>
      </div>

      <FitRulesManager rules={rules} canWrite={canWrite} />
    </div>
  );
}
