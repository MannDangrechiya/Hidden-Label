"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";

export interface SizeOption {
  variantId: string;
  label: string;
  available: boolean;
  /** Null when Medusa does not expose stock (the normal case for the store API). */
  quantity: number | null;
}

/**
 * Size selector + add to bag. Sold-out sizes are disabled **with a visible reason**
 * (DESIGN_TOKENS.md §6), never silently dimmed.
 */
export function AddToBag({ sizes }: { sizes: SizeOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(
    sizes.find((size) => size.available)?.variantId ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const chosen = sizes.find((size) => size.variantId === selected) ?? null;

  function submit() {
    if (!selected) {
      setMessage("Select a size first.");
      return;
    }
    startTransition(async () => {
      const result = await addToCart(selected, 1);
      if (result.ok) {
        setAdded(true);
        setMessage("Added to bag.");
        router.refresh();
      } else {
        setMessage(result.message ?? "Could not add to bag.");
      }
    });
  }

  if (sizes.length === 0) {
    return (
      <p className="border border-line px-4 py-3 font-sans text-body-sm text-on-surface-variant">
        This product has no purchasable variants yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-mono text-label-caps uppercase text-on-surface-variant">
          Size
        </legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const isSelected = size.variantId === selected;
            return (
              <button
                key={size.variantId}
                type="button"
                onClick={() => {
                  setSelected(size.variantId);
                  setAdded(false);
                  setMessage(null);
                }}
                disabled={!size.available}
                aria-pressed={isSelected}
                title={size.available ? undefined : "Out of stock in this size"}
                className={[
                  "min-h-12 min-w-20 px-4 font-mono text-label-caps uppercase transition-colors",
                  size.available
                    ? isSelected
                      ? "bg-ink text-white"
                      : "border border-ink bg-transparent text-ink hover:bg-ink hover:text-white"
                    : "cursor-not-allowed border border-line bg-line text-muted",
                ].join(" ")}
              >
                {size.label}
              </button>
            );
          })}
        </div>
        {sizes.some((size) => !size.available) ? (
          <p className="font-sans text-body-sm text-muted">
            Dimmed sizes are out of stock and cannot be added.
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !chosen}
          aria-busy={pending || undefined}
          className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white transition-colors enabled:hover:bg-accent enabled:hover:text-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {pending ? "Adding…" : "Add to bag"}
        </button>

        <div aria-live="polite" className="min-h-5">
          {message ? (
            <p
              className={`font-sans text-body-sm ${added ? "text-on-surface-variant" : "text-error"}`}
            >
              {message}
              {added ? (
                <>
                  {" "}
                  <a href="/cart" className="underline">
                    View bag
                  </a>
                </>
              ) : null}
            </p>
          ) : chosen && chosen.quantity !== null && chosen.quantity > 0 && chosen.quantity <= 2 ? (
            <p className="font-sans text-body-sm text-muted">
              Only {chosen.quantity} left in {chosen.label}.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
