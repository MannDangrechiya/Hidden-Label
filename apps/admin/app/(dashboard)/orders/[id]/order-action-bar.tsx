"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@thl/ui";
import { orderActionHandler, type OrderActionState } from "../actions";
import type { OrderAction } from "../../../../lib/api/orders";

const EMPTY_STATE: OrderActionState = {};

const ACTIONS: { action: OrderAction; label: string; needsReason: boolean }[] = [
  { action: "capture", label: "Capture payment", needsReason: false },
  { action: "fulfill", label: "Fulfil remaining items", needsReason: false },
  { action: "cancel", label: "Cancel order", needsReason: true },
  { action: "refund", label: "Refund", needsReason: true },
];

export function OrderActionBar({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(orderActionHandler, EMPTY_STATE);
  const [active, setActive] = useState<OrderAction | null>(null);

  const current = ACTIONS.find((a) => a.action === active);

  return (
    <div className="flex flex-col gap-4 border border-line bg-surface p-5">
      <h2 className="font-display text-headline-sm">Actions</h2>
      <div className="flex flex-wrap gap-3">
        {ACTIONS.map((a) => (
          <Button
            key={a.action}
            variant={active === a.action ? "primary" : "secondary"}
            onClick={() => setActive(a.action)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      {current ? (
        <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="action" value={current.action} />
          {current.needsReason ? (
            <Input label="Reason" name="reason" required />
          ) : null}
          {current.action === "refund" ? (
            <Input
              label="Amount (₹) — leave blank to refund the full captured amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
            />
          ) : null}
          {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
          {state.success ? <p className="font-sans text-body-sm text-on-surface">{state.success}</p> : null}
          <Button type="submit" loading={pending}>
            Confirm {current.label.toLowerCase()}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
