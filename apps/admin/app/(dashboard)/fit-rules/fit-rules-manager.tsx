"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button, EmptyState, Input, Modal, Table } from "@thl/ui";
import type { AdminFitRule } from "../../../lib/api/resale";
import { createFitRuleAction, deleteFitRuleAction, type FitRuleFormState } from "./actions";

const EMPTY_STATE: FitRuleFormState = {};

export function FitRulesManager({
  rules,
  canWrite,
}: {
  rules: AdminFitRule[];
  canWrite: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [createState, createFormAction, createPending] = useActionState(createFitRuleAction, EMPTY_STATE);
  const [, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (createState.success) setCreating(false);
  }, [createState]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-body-sm text-on-surface-variant">{rules.length} silhouette rules</p>
        {canWrite ? (
          <Button onClick={() => setCreating(true)}>New fit rule</Button>
        ) : (
          <span className="font-mono text-xs uppercase text-muted">Read-only</span>
        )}
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="No fit rules yet"
          description={
            canWrite ? "Create the first silhouette rule to guide sizing recommendations." : "No fit rules have been created."
          }
        />
      ) : (
        <Table<AdminFitRule>
          columns={[
            {
              key: "silhouette",
              header: "Silhouette",
              render: (r: AdminFitRule) => (
                <div>
                  <p className="font-semibold text-ink">{r.silhouette_name}</p>
                  {r.brand_name ? <p className="font-mono text-xs text-muted">{r.brand_name}</p> : null}
                </div>
              ),
              sticky: true,
            },
            {
              key: "tendency",
              header: "Fit Tendency",
              render: (r: AdminFitRule) => (
                <span className="font-mono text-xs uppercase text-muted">
                  {r.fit_tendency.replace(/_/g, " ")}
                </span>
              ),
            },
            {
              key: "delta",
              header: "Size Delta",
              render: (r: AdminFitRule) => (
                <span className="font-mono text-xs font-semibold">
                  {Number(r.recommended_size_delta) >= 0
                    ? `+${r.recommended_size_delta}`
                    : r.recommended_size_delta}
                </span>
              ),
            },
            {
              key: "width",
              header: "Width Profile",
              render: (r: AdminFitRule) => (
                <span className="font-mono text-xs capitalize text-muted">
                  {r.width_profile}
                </span>
              ),
            },
            {
              key: "guidance",
              header: "Customer Guidance Note",
              render: (r: AdminFitRule) => (
                <span className="font-sans text-xs text-on-surface-variant max-w-md line-clamp-2">
                  {r.guidance_text}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (r: AdminFitRule) =>
                canWrite ? (
                  <button
                    type="button"
                    className="font-mono text-label-caps uppercase text-error underline"
                    onClick={() => {
                      if (confirm(`Delete fit rule for "${r.silhouette_name}"?`)) {
                        startDeleteTransition(() => deleteFitRuleAction(r.id));
                      }
                    }}
                  >
                    Delete
                  </button>
                ) : null,
            },
          ]}
          rows={rules}
          rowKey={(r) => r.id}
        />
      )}

      <Modal
        title="Create fit rule"
        open={creating}
        onClose={() => setCreating(false)}
      >
        <form action={createFormAction} className="flex flex-col gap-4">
          {createState.error ? (
            <p className="font-sans text-body-sm text-error">{createState.error}</p>
          ) : null}

          <Input label="Silhouette name" name="silhouette_name" placeholder="e.g. Air Jordan 1 High" required />
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 font-sans text-body-sm">
              <span className="font-mono text-label-caps uppercase text-muted">Fit Tendency</span>
              <select
                name="fit_tendency"
                defaultValue="true_to_size"
                className="min-h-12 border border-line bg-white px-3 font-sans text-body-sm text-ink outline-none"
              >
                <option value="true_to_size">True to Size</option>
                <option value="runs_small">Runs Small</option>
                <option value="runs_large">Runs Large</option>
                <option value="runs_narrow">Runs Narrow</option>
                <option value="runs_wide">Runs Wide</option>
              </select>
            </label>

            <Input
              label="Size Delta"
              name="recommended_size_delta"
              type="number"
              step="0.5"
              defaultValue={0}
            />

            <label className="flex flex-col gap-1 font-sans text-body-sm">
              <span className="font-mono text-label-caps uppercase text-muted">Width Profile</span>
              <select
                name="width_profile"
                defaultValue="regular"
                className="min-h-12 border border-line bg-white px-3 font-sans text-body-sm text-ink outline-none"
              >
                <option value="regular">Regular</option>
                <option value="narrow">Narrow</option>
                <option value="wide">Wide</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 font-sans text-body-sm">
            <span className="font-mono text-label-caps uppercase text-muted">Customer Guidance Note</span>
            <textarea
              name="guidance_text"
              rows={3}
              placeholder="Guidance explanation shown to customer in Fit Studio..."
              required
              className="border border-line bg-white p-3 font-sans text-body-sm text-ink outline-none"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 font-mono text-label-caps uppercase text-muted hover:text-ink"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <Button type="submit" loading={createPending}>
              Save fit rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
