"use client";

import { useActionState } from "react";
import { StatusChip } from "@thl/ui";
import {
  BESPOKE_STAGES,
  bespokeStageIndex,
  fitPreferenceLabel,
  type BespokeItem,
  type BespokeStage,
} from "../../../../lib/bespoke";
import { setBespokeStageAction, type BespokeStageState } from "../actions";

const EMPTY_STATE: BespokeStageState = {};

function measurementRows(measurements: BespokeItem["measurements"]): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: number | null, unit = "in") => {
    if (value === null) return;
    rows.push({ label, value: `${value} ${unit}` });
  };

  add("Chest", measurements.chest_inches);
  add("Waist", measurements.waist_inches);
  add("Shoulder", measurements.shoulder_inches);
  add("Sleeve", measurements.sleeve_inches);
  add("Trouser inseam", measurements.inseam_inches);

  return rows;
}

/**
 * A-08 extension — the master tailor's sheet plus the bespoke order pipeline. Rendered only when
 * at least one line item carries `metadata.custom_measurements`; ready-to-wear orders never see
 * tailoring steps.
 */
export function BespokePipeline({
  orderId,
  items,
  currentStage,
  canAct,
}: {
  orderId: string;
  items: BespokeItem[];
  currentStage: BespokeStage | null;
  canAct: boolean;
}) {
  const [state, formAction, pending] = useActionState(setBespokeStageAction, EMPTY_STATE);
  const currentIndex = bespokeStageIndex(currentStage);
  const currentLabel =
    BESPOKE_STAGES.find((entry) => entry.key === currentStage)?.label ?? "Not started";

  return (
    <section className="flex flex-col gap-4 border border-ink bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-headline-sm uppercase">Master tailor sheet</h2>
          <p className="mt-1 font-sans text-body-sm text-on-surface-variant">
            Made-to-measure line items on this order. Verified before any fabric is cut.
          </p>
        </div>
        <StatusChip tone={currentIndex >= 3 ? "positive" : currentIndex >= 0 ? "warning" : "neutral"}>
          {currentLabel}
        </StatusChip>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => {
          const rows = measurementRows(item.measurements);
          return (
            <article key={item.id} className="border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                <h3 className="font-display text-body-lg uppercase text-ink">{item.title}</h3>
                <span className="font-mono text-label-caps uppercase text-muted">
                  Qty {item.quantity}
                </span>
              </div>

              <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex flex-col">
                  <dt className="font-mono text-label-caps uppercase text-muted">Base size</dt>
                  <dd className="m-0 font-mono text-body-sm text-ink">
                    {item.measurements.base_size ?? item.variantTitle ?? "—"}
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="font-mono text-label-caps uppercase text-muted">Garment</dt>
                  <dd className="m-0 font-mono text-body-sm text-ink">{item.garmentType ?? "Bespoke"}</dd>
                </div>
                <div className="col-span-2 flex flex-col">
                  <dt className="font-mono text-label-caps uppercase text-muted">Fit preference</dt>
                  <dd className="m-0 font-sans text-body-sm text-on-surface">
                    {fitPreferenceLabel(item.measurements.fit_preference)}
                  </dd>
                </div>
              </dl>

              <table className="mt-3 w-full border-collapse text-left">
                <caption className="sr-only">Measurements in inches for {item.title}</caption>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="border border-line px-3 py-2 font-sans text-body-sm text-error">
                        No measurements were captured on this line.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.label}>
                        <th
                          scope="row"
                          className="border border-line px-3 py-2 font-mono text-label-caps uppercase text-muted"
                        >
                          {row.label}
                        </th>
                        <td className="border border-line px-3 py-2 font-mono text-currency-md tabular text-ink">
                          {row.value}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {item.measurements.notes ? (
                <div className="mt-3 border border-line bg-surface-container/40 p-3">
                  <p className="font-mono text-label-caps uppercase text-muted">Client instructions</p>
                  <p className="mt-1 font-sans text-body-sm text-on-surface">{item.measurements.notes}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="order_id" value={orderId} />
        <p className="font-mono text-label-caps uppercase text-muted">Advance the pipeline</p>
        <div className="flex flex-wrap gap-2">
          {BESPOKE_STAGES.map((stage, index) => {
            const done = currentIndex >= index;
            const isCurrent = currentIndex === index;
            return (
              <button
                key={stage.key}
                type="submit"
                name="stage"
                value={stage.key}
                disabled={!canAct || pending}
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "min-h-11 border px-4 font-mono text-label-caps uppercase tracking-[0.08em] transition-colors",
                  isCurrent
                    ? "border-ink bg-ink text-white"
                    : done
                      ? "border-ink bg-surface-container text-ink"
                      : "border-line bg-surface text-on-surface-variant hover:border-ink hover:text-ink",
                  canAct && !pending ? "" : "cursor-not-allowed opacity-60",
                ].join(" ")}
              >
                {index + 1}. {stage.label}
              </button>
            );
          })}
        </div>

        {!canAct ? (
          <p className="font-sans text-body-sm text-muted">
            Your role is read-only — an operations or owner account can advance tailoring stages.
          </p>
        ) : null}
        {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
        {state.success ? <p className="font-sans text-body-sm text-on-surface">{state.success}</p> : null}
      </form>
    </section>
  );
}
