"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Input, Modal } from "@thl/ui";
import { createShipmentAction, type ShipmentFormState } from "./actions";

const EMPTY_STATE: ShipmentFormState = {};

export function CreateShipmentForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createShipmentAction, EMPTY_STATE);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>New shipment</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New shipment">
        <form action={formAction} className="flex flex-col gap-4">
          <Input label="Order ID" name="order_id" required hint="The order's internal id (order_01…)." />
          <Input label="Courier" name="courier" placeholder="e.g. BlueDart" />
          {state.error ? <p className="font-sans text-body-sm text-error">{state.error}</p> : null}
          <Button type="submit" loading={pending}>
            Create shipment
          </Button>
        </form>
      </Modal>
    </>
  );
}
