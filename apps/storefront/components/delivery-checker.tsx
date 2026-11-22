"use client";

import { useState, useTransition } from "react";
import { lookupPincodeAction } from "@/app/actions/pincode";

export function DeliveryChecker() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ok: boolean; city?: string; state?: string; message?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pin.replace(/\D/g, "");
    if (clean.length !== 6) {
      setResult({ ok: false, message: "Enter a valid 6-digit PIN code." });
      return;
    }

    startTransition(async () => {
      const res = await lookupPincodeAction(clean);
      setResult(res);
    });
  };

  return (
    <div className="border border-line bg-surface p-4">
      <span className="block font-mono text-label-caps uppercase text-muted mb-2">
        Check Delivery &amp; Serviceability
      </span>
      <form onSubmit={handleCheck} className="flex gap-2">
        <input
          type="text"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
            if (result) setResult(null);
          }}
          placeholder="Enter 6-digit PIN"
          maxLength={6}
          className="w-40 border border-line bg-surface px-3 py-1.5 font-mono text-xs uppercase text-ink outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending || pin.length !== 6}
          className="border border-ink bg-ink px-4 py-1.5 font-mono text-xs uppercase text-white hover:bg-surface hover:text-ink disabled:opacity-40 transition-colors"
        >
          {pending ? "Checking..." : "Check"}
        </button>
      </form>

      {result && (
        <div className="mt-3 text-xs font-sans">
          {result.ok ? (
            <div className="text-emerald-700">
              <span className="font-semibold">✓ Serviceable:</span> Delivery to {result.city}, {result.state} within 2–4 working days. Complimentary standard shipping applies.
            </div>
          ) : (
            <div className="text-rose-600">
              {result.message ?? "PIN code not serviceable via standard courier."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
