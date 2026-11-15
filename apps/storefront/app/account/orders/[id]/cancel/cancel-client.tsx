"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction } from "@/app/actions/account";

const REASONS = [
  "Changed my mind",
  "Ordered wrong size or color",
  "Expected delivery date too late",
  "Found better price elsewhere",
  "Incorrect shipping address",
  "Other reason",
];

export function CancelOrderForm({
  orderId,
  orderDisplayId,
}: {
  orderId: string;
  orderDisplayId: number | string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(REASONS[0]);
  const [customNote, setCustomNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      const fullReason = reason === "Other reason" && customNote ? `Other: ${customNote}` : reason;
      const res = await cancelOrderAction(orderId, fullReason);
      if (res.ok) {
        router.push(`/account/orders/${orderId}`);
      } else {
        setError(res.message ?? "Could not cancel the order.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 border border-line bg-surface p-6">
      <p className="font-mono text-label-caps uppercase text-muted">Order THL-{orderDisplayId}</p>
      <div>
        <label htmlFor="reason" className="font-mono text-label-caps uppercase text-muted block mb-2">
          Select Cancellation Reason
        </label>
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border border-line bg-surface p-3 font-sans text-body-sm text-ink focus:border-ink focus:outline-none"
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {reason === "Other reason" && (
        <div>
          <label htmlFor="customNote" className="font-mono text-label-caps uppercase text-muted block mb-2">
            Details
          </label>
          <textarea
            id="customNote"
            rows={3}
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Please specify why you wish to cancel..."
            className="w-full border border-line bg-surface p-3 font-sans text-body-sm text-ink focus:border-ink focus:outline-none"
          />
        </div>
      )}

      {error && <p className="font-sans text-body-sm text-error">{error}</p>}

      <div className="flex items-center gap-4 pt-3 border-t border-line">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="border border-error bg-error/10 px-6 py-3 font-mono text-label-caps uppercase text-error transition-colors hover:bg-error hover:text-white disabled:opacity-50"
        >
          {pending ? "Cancelling Order…" : "Confirm Order Cancellation"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="border border-line px-6 py-3 font-mono text-label-caps uppercase text-muted transition-colors hover:border-ink hover:text-ink"
        >
          Keep order
        </button>
      </div>
    </div>
  );
}
