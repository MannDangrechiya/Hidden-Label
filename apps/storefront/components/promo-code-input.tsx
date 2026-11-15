"use client";

import { useActionState } from "react";
import { applyPromotionAction, removePromotionAction } from "@/app/actions/cart";

interface PromoCodeInputProps {
  promotions?: {
    id: string;
    code: string;
  }[];
}

export function PromoCodeInput({ promotions = [] }: PromoCodeInputProps) {
  const [applyState, applyAction, isApplying] = useActionState(applyPromotionAction, null);
  const [removeState, removeAction, isRemoving] = useActionState(removePromotionAction, null);

  const activePromos = promotions.filter((p) => Boolean(p.code));

  return (
    <div className="flex flex-col gap-2 py-3 border-t border-line">
      <span className="font-mono text-label-caps uppercase text-muted">Promo Code / Voucher</span>

      {activePromos.length > 0 ? (
        <div className="flex flex-col gap-2">
          {activePromos.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-surface-container/50 px-3 py-2 border border-line">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase font-semibold text-emerald-600">✓ {p.code}</span>
                <span className="font-mono text-[10px] uppercase text-muted">Applied</span>
              </div>
              <form action={removeAction}>
                <input type="hidden" name="code" value={p.code} />
                <button
                  type="submit"
                  disabled={isRemoving}
                  className="font-mono text-[10px] uppercase text-error hover:underline disabled:opacity-50"
                >
                  {isRemoving ? "Removing…" : "Remove"}
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <form action={applyAction} className="flex gap-2">
          <input
            type="text"
            name="code"
            placeholder="ENTER CODE"
            required
            className="flex-1 border border-line bg-surface px-3 py-2 font-mono text-xs uppercase placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={isApplying}
            className="border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase text-white hover:bg-accent hover:text-ink disabled:opacity-50"
          >
            {isApplying ? "Applying…" : "Apply"}
          </button>
        </form>
      )}

      {applyState && !applyState.ok && (
        <p className="font-sans text-xs text-error">{applyState.message}</p>
      )}
      {removeState && !removeState.ok && (
        <p className="font-sans text-xs text-error">{removeState.message}</p>
      )}
    </div>
  );
}
