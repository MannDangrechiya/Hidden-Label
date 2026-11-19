"use client";

import { moneyFromRupees } from "@thl/shared";
import { Price } from "@thl/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removeFromCart, setLineQuantity } from "@/app/actions/cart";
import type { StoreCart } from "@/lib/medusa";

function lineTotal(item: { total?: number; unit_price: number; quantity: number }): number {
  return typeof item.total === "number" ? item.total : item.unit_price * item.quantity;
}

/**
 * U-11 slide-in bag drawer. The header passes `initialCount` from its own server-side cart
 * fetch so the trigger never flashes 0; the drawer's own contents are always refetched on open
 * (and after every mutation) through `/api/cart`, since the header's server render can be stale
 * by the time the drawer opens.
 */
export function CartDrawer({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const items = cart?.items ?? [];
  const count = open ? items.reduce((total, item) => total + item.quantity, 0) : initialCount;

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      const body = (await res.json()) as { cart: StoreCart | null };
      setCart(body.cart);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function mutate(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      await refresh();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}
        className="whitespace-nowrap font-mono text-xs sm:text-label-caps uppercase text-ink no-underline"
      >
        Bag <span className="tabular">({count})</span>
      </button>

      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex justify-end bg-canvas/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your bag"
            onClick={(event) => event.stopPropagation()}
            className="flex h-full w-full max-w-sm flex-col border-l border-ink bg-white"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <h2 className="font-mono text-label-caps uppercase text-ink">Your bag</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close bag"
                className="font-mono text-label-caps uppercase text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <p className="font-mono text-label-caps uppercase text-muted">Loading…</p>
              ) : items.length === 0 ? (
                <p className="font-sans text-body-sm text-on-surface-variant">
                  Nothing in the bag yet.
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-4 p-0">
                  {items.map((item) => (
                    <li key={item.id} className="grid grid-cols-[64px_1fr] gap-3">
                      <div className="aspect-[3/4] w-16 bg-surface-container">
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.product_title ?? item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-sans text-body-sm font-medium text-ink">
                          {item.product_title ?? item.title}
                        </span>
                        <span className="font-mono text-[11px] uppercase text-muted">
                          {item.variant_title ?? "One size"}
                        </span>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => mutate(() => setLineQuantity(item.id, item.quantity - 1))}
                              aria-label="Decrease quantity"
                              className="h-7 w-7 border border-line font-mono text-xs text-ink hover:border-ink disabled:opacity-50"
                            >
                              −
                            </button>
                            <span className="min-w-6 text-center font-mono text-xs tabular">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => mutate(() => setLineQuantity(item.id, item.quantity + 1))}
                              aria-label="Increase quantity"
                              className="h-7 w-7 border border-line font-mono text-xs text-ink hover:border-ink disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                          <Price value={moneyFromRupees(lineTotal(item))} />
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => mutate(() => removeFromCart(item.id))}
                          className="mt-1 self-start font-mono text-[11px] uppercase text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 ? (
              <div className="border-t border-line px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-label-caps uppercase text-muted">Subtotal</span>
                  <Price value={moneyFromRupees(cart?.item_total ?? 0)} size="lg" />
                </div>
                <Link
                  href="/checkout"
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 w-full items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
                >
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex min-h-10 w-full items-center justify-center border border-line px-6 py-2 font-mono text-label-caps uppercase text-ink no-underline transition-colors hover:border-ink"
                >
                  View bag
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
