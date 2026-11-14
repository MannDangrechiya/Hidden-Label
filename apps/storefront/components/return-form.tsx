"use client";

import { Button, Select } from "@thl/ui";
import { RETURN_REASONS } from "@thl/shared";
import { useState, useTransition } from "react";
import { createReturnAction } from "@/app/actions/returns";

export interface ReturnableItem {
  id: string;
  title: string;
  quantity: number;
}

export function ReturnForm({ orderId, items }: { orderId: string; items: ReturnableItem[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");

  function submit(formData: FormData) {
    setMessage(null);
    formData.set("order_id", orderId);
    startTransition(async () => {
      const result = await createReturnAction(formData);
      setMessage(result.message ?? null);
      setOk(result.ok);
    });
  }

  if (ok) {
    return (
      <p role="status" className="border border-ink px-4 py-3 font-sans text-body-sm text-ink">
        {message} Track its progress from your order history.
      </p>
    );
  }

  const selected = items.find((item) => item.id === itemId);

  return (
    <form action={submit} className="flex flex-col gap-sp-3">
      <Select label="Item" name="order_item_id" value={itemId} onChange={(event) => setItemId(event.target.value)}>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title} (qty {item.quantity})
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-label-caps uppercase text-on-surface-variant" htmlFor="return-quantity">
          Quantity to return
        </label>
        <input
          id="return-quantity"
          name="quantity"
          type="number"
          min={1}
          max={selected?.quantity ?? 1}
          defaultValue={1}
          className="w-32 border border-line bg-surface px-3 py-3 font-sans text-body-md text-ink outline-none focus:border-ink"
        />
      </div>

      <Select label="Reason" name="reason_code" defaultValue={RETURN_REASONS[0]?.value}>
        {RETURN_REASONS.map((reason) => (
          <option key={reason.value} value={reason.value}>
            {reason.label}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-2">
        <label className="font-mono text-label-caps uppercase text-on-surface-variant" htmlFor="return-note">
          Note (optional)
        </label>
        <textarea
          id="return-note"
          name="note"
          rows={3}
          className="w-full border border-line bg-surface px-3 py-3 font-sans text-body-md text-ink outline-none focus:border-ink"
        />
      </div>

      {message ? (
        <p role="alert" className="font-sans text-body-sm text-error">
          {message}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full" disabled={items.length === 0}>
        Submit return request
      </Button>
    </form>
  );
}
