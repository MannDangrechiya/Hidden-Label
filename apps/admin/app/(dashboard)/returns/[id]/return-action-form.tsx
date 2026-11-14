"use client";

import { useActionState, useState } from "react";
import { Button, Input } from "@thl/ui";
import type { ReturnAction, ReturnRequest } from "../../../../lib/api/returns";
import { actOnReturnAction, type ReturnActionState } from "../actions";

const EMPTY_STATE: ReturnActionState = {};

const NEXT_ACTIONS: Record<ReturnRequest["status"], ReturnAction[]> = {
  requested: ["approve", "reject"],
  approved: ["receive", "reject"],
  in_transit: ["receive"],
  received: ["refund", "reject"],
  inspecting: ["refund", "reject"],
  refunded: [],
  rejected: [],
  closed: [],
};

export function ReturnActionForm({ request }: { request: ReturnRequest }) {
  const [state, formAction, pending] = useActionState(actOnReturnAction, EMPTY_STATE);
  const [action, setAction] = useState<ReturnAction | null>(null);
  const available = NEXT_ACTIONS[request.status];

  if (available.length === 0) {
    return <p className="font-sans text-body-sm text-muted">This return is closed — no further action is possible.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        {available.map((a) => (
          <Button key={a} variant={action === a ? "primary" : "secondary"} onClick={() => setAction(a)}>
            {a}
          </Button>
        ))}
      </div>
      {action ? (
        <form action={formAction} className="flex flex-col gap-3 border-t border-line pt-4">
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="action" value={action} />
          <Input label="Note" name="note" />
          {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
          {state.success ? <p className="font-sans text-body-sm text-on-surface">Done.</p> : null}
          <Button type="submit" loading={pending}>
            Confirm {action}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
