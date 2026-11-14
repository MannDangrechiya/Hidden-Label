"use client";

import { useActionState } from "react";
import { Button, Input } from "@thl/ui";
import type { Shipment } from "../../../../lib/api/shipments";
import { updateShipmentAction, type ShipmentFormState } from "../actions";

const EMPTY_STATE: ShipmentFormState = {};
const STATUSES = ["created", "pickup_scheduled", "picked_up", "in_transit", "delivered", "failed", "rto"];

export function UpdateShipmentForm({ shipment }: { shipment: Shipment }) {
  const [state, formAction, pending] = useActionState(updateShipmentAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4 border border-line bg-surface p-5">
      <input type="hidden" name="id" value={shipment.id} />
      <label className="flex flex-col gap-2">
        <span className="font-mono text-label-caps uppercase text-on-surface-variant">Status</span>
        <select
          name="status"
          defaultValue={shipment.status}
          className="border border-line bg-surface px-3 py-3 font-sans text-body-md outline-none focus:border-ink"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <Input label="AWB" name="awb" defaultValue={shipment.awb ?? ""} />
      <Input label="Courier" name="courier" defaultValue={shipment.courier ?? ""} />
      <Input label="Note" name="note" />
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      {state.success ? <p className="font-sans text-body-sm text-on-surface">Saved.</p> : null}
      <Button type="submit" loading={pending} className="self-start">
        Record update
      </Button>
    </form>
  );
}
