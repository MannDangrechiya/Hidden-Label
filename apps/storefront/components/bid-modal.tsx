"use client";

import { Button, Modal } from "@thl/ui";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { formatINR, moneyFromRupees } from "@thl/shared";
import { placeBidAction } from "@/app/actions/resale";

export interface BidModalProps {
  open: boolean;
  onClose: () => void;
  variantId: string | null;
  sizeLabel: string;
  /** Rupee integer — ₹21,999 is 21999, never paise. */
  suggestedBid: number;
  lowestAsk?: number | null;
  signedIn: boolean;
}

const EXPIRY_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days (standard)" },
];

function rupees(value: number | null | undefined): string | null {
  if (typeof value !== "number" || value <= 0) return null;
  try {
    return formatINR(moneyFromRupees(value));
  } catch {
    return null;
  }
}

/**
 * Buyer orderbook bid dialog. Submits through the `placeBidAction` Server Action, which calls
 * `POST /store/resale/bids` with the customer's bearer token read from the httpOnly cookie — the
 * browser never holds the token. Bids are only shown as placed when the backend returns a bid id.
 */
export function BidModal({
  open,
  onClose,
  variantId,
  sizeLabel,
  suggestedBid,
  lowestAsk,
  signedIn,
}: BidModalProps) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState<string>(String(Math.max(500, Math.round(suggestedBid))));
  const [expiryDays, setExpiryDays] = useState(30);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [placedAt, setPlacedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(String(Math.max(500, Math.round(suggestedBid))));
    setExpiryDays(30);
    setMessage(null);
    setPlacedAt(null);
  }, [open, suggestedBid, variantId]);

  const parsed = Math.round(Number(amount));
  const valid = Number.isFinite(parsed) && parsed >= 500;
  const askLabel = rupees(lowestAsk);

  function submit() {
    if (!variantId) return;
    if (!signedIn) {
      setMessage({ text: "Sign in to place a bid — your offer is tied to your account.", tone: "error" });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await placeBidAction({ variantId, bidPrice: parsed, expiresInDays: expiryDays });
      if (result.ok) {
        const expires = result.bid?.expires_at
          ? new Date(result.bid.expires_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : `${expiryDays} days from now`;
        setPlacedAt(expires);
        setMessage({ text: `Bid of ${rupees(parsed) ?? `₹${parsed}`} is live and expires ${expires}.`, tone: "success" });
      } else {
        setMessage({ text: result.message ?? "Could not place that bid.", tone: "error" });
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Place bid — ${sizeLabel}`}>
      <div className="flex flex-col gap-sp-3">
        <dl className="m-0 grid grid-cols-2 gap-2 border border-line bg-surface-container/40 p-3 font-mono text-label-caps uppercase">
          <div className="flex flex-col gap-1">
            <dt className="text-muted">Size in the orderbook</dt>
            <dd className="m-0 text-ink">{sizeLabel}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted">Lowest ask</dt>
            <dd className="m-0 text-ink">{askLabel ?? "No live ask"}</dd>
          </div>
        </dl>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-label-caps uppercase text-on-surface-variant">Your bid (INR)</span>
          <div className="flex items-stretch">
            <span className="flex items-center border border-r-0 border-line bg-surface-container px-3 font-mono text-body-md text-muted">
              ₹
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={500}
              step={100}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={!valid}
              className="h-12 w-full min-w-0 border border-line bg-surface px-3 font-mono text-body-md tabular text-ink outline-none focus:border-ink"
            />
          </div>
          <span className="font-sans text-body-sm text-muted">
            Stored as a plain rupee amount. {askLabel ? `You may bid below the ${askLabel} ask — the seller decides.` : "There is no live ask for this size yet."}
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-label-caps uppercase text-on-surface-variant">Offer valid for</span>
          <select
            value={expiryDays}
            onChange={(event) => setExpiryDays(Number(event.target.value))}
            className="h-12 border border-line bg-surface px-3 font-mono text-body-sm text-ink outline-none focus:border-ink"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {message ? (
          <p
            role="status"
            className={[
              "border px-3 py-2 font-sans text-body-sm",
              message.tone === "error"
                ? "border-error bg-error-container text-error"
                : "border-ink bg-ink text-white",
            ].join(" ")}
          >
            {message.text}
          </p>
        ) : null}

        {signedIn ? (
          <Button type="button" onClick={submit} loading={pending} disabled={!valid || Boolean(placedAt)}>
            {placedAt ? "Bid placed" : `Submit bid${valid ? ` · ${rupees(parsed) ?? `₹${parsed}`}` : ""}`}
          </Button>
        ) : (
          <Link
            href="/login"
            className="flex min-h-12 items-center justify-center border border-ink bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
          >
            Sign in to bid
          </Link>
        )}

        <p className="font-sans text-body-sm text-muted">
          A bid is an offer, not a purchase — nothing is charged now. If a seller accepts, the ask
          price is locked to you and payment is requested then.
        </p>
        <Link href="/account/bids" className="font-mono text-label-caps uppercase text-ink underline underline-offset-4">
          View your active bids
        </Link>
      </div>
    </Modal>
  );
}
