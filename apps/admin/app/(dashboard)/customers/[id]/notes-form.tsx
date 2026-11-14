"use client";

import { useActionState } from "react";
import { Button, Input } from "@thl/ui";
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
