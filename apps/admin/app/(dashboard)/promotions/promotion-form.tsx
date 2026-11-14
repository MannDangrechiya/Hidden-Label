"use client";

import { useActionState } from "react";
import { Button, Input, Select } from "@thl/ui";
import type { Promotion } from "../../../lib/api/promotions";
import { createPromotionAction, updatePromotionAction, type PromotionFormState } from "./actions";

const EMPTY_STATE: PromotionFormState = {};

export function PromotionForm({ promotion }: { promotion?: Promotion }) {
  const action = promotion ? updatePromotionAction : createPromotionAction;
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4 border border-line bg-surface p-6">
      {promotion ? <input type="hidden" name="id" value={promotion.id} /> : null}
      <Input
        label="Code"
        name="code"
        defaultValue={promotion?.code ?? ""}
        disabled={Boolean(promotion)}
        required
        hint="Customers enter this at checkout."
      />
      <Select label="Discount type" name="amount_type" defaultValue={promotion?.application_method?.type ?? "percentage"}>
        <option value="percentage">Percentage off</option>
        <option value="fixed">Fixed amount off (₹)</option>
      </Select>
      <Input
        label="Value"
        name="value"
        type="number"
        step="0.01"
        min="0"
        defaultValue={promotion?.application_method?.value ?? ""}
        required
      />
      <Select label="Status" name="status" defaultValue={promotion?.status ?? "active"}>
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </Select>
      <Input
        label="Usage limit"
        name="usage_limit"
        type="number"
        min="0"
        defaultValue={promotion?.usage_limit ?? ""}
        hint="Leave blank for unlimited."
      />
      <label className="flex items-center gap-2 font-sans text-body-sm text-on-surface-variant">
        <input type="checkbox" name="is_automatic" defaultChecked={promotion?.is_automatic ?? false} />
        Apply automatically (no code entry required)
      </label>
      {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
      <Button type="submit" loading={pending}>
        {promotion ? "Save changes" : "Create promotion"}
      </Button>
    </form>
  );
}
