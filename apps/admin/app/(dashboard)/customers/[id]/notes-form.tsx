"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@thl/ui";
import type { CustomerDetail } from "../../../../lib/api/customers";
import { updateCustomerNotesAction, type CustomerNotesState } from "../actions";

const EMPTY_STATE: CustomerNotesState = {};

export function NotesForm({ customer, canWrite }: { customer: CustomerDetail; canWrite: boolean }) {
  const [state, formAction, pending] = useActionState(updateCustomerNotesAction, EMPTY_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4 border border-line bg-surface p-5">
      <input type="hidden" name="id" value={customer.id} />
      <Input
        label="Tier"
        name="tier"
        defaultValue={String(customer.metadata?.tier ?? "")}
        placeholder="e.g. gold, silver"
        disabled={!canWrite}
      />
      <Select
        label="Risk flag"
        name="risk_flag"
        defaultValue={String(customer.metadata?.risk_flag ?? "none")}
        disabled={!canWrite}
      >
        <option value="none">None</option>
        <option value="watch">Watch — review before approving returns/refunds</option>
        <option value="blocked">Blocked — do not fulfil new orders</option>
      </Select>
      <Input
        label="Risk note (shown to staff only, never to the customer)"
        name="risk_note"
        defaultValue={String(customer.metadata?.risk_note ?? "")}
        disabled={!canWrite}
      />
      <Input
        label="Internal notes"
        name="notes"
        defaultValue={String(customer.metadata?.notes ?? "")}
        disabled={!canWrite}
      />
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      {state.success ? <p className="font-sans text-body-sm text-on-surface">Saved.</p> : null}
      {canWrite ? (
        <Button type="submit" loading={pending} className="self-start">
          Save
        </Button>
      ) : null}
    </form>
  );
}
