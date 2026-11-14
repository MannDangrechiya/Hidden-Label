import type { Metadata } from "next";
import { ErrorState } from "@thl/ui";
import { fetchAdminFitRules } from "../../../lib/api/resale";
import { BackendError } from "../../../lib/backend";

export const metadata: Metadata = { title: "Fit Studio Rules" };

/** A-20 — Fit Studio silhouette sizing rules. */
export default async function FitRulesPage() {
  let rules;
  try {
    rules = await fetchAdminFitRules();
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

      <div className="overflow-x-auto border border-line bg-white">
        <table className="w-full text-left font-sans text-body-sm">
          <thead className="border-b border-line bg-surface-container/50 font-mono text-label-caps uppercase text-muted">
            <tr>
              <th className="p-3">Silhouette</th>
              <th className="p-3">Fit Tendency</th>
              <th className="p-3">Size Delta</th>
              <th className="p-3">Width Profile</th>
              <th className="p-3">Customer Guidance Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-surface-container/20">
                <td className="p-3 font-semibold text-ink">{rule.silhouette_name}</td>
                <td className="p-3 font-mono text-xs uppercase text-muted">
                  {rule.fit_tendency.replace(/_/g, " ")}
                </td>
                <td className="p-3 font-mono text-xs font-semibold">
                  {Number(rule.recommended_size_delta) >= 0
                    ? `+${rule.recommended_size_delta}`
                    : rule.recommended_size_delta}
                </td>
                <td className="p-3 font-mono text-xs capitalize text-muted">
                  {rule.width_profile}
                </td>
                <td className="p-3 font-sans text-xs text-on-surface-variant max-w-md">
                  {rule.guidance_text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
