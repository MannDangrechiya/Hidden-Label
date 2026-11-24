import { moneyFromRupees } from "@thl/shared";
import { Price } from "@thl/ui";
import Link from "next/link";
import { removeLineAction, setQuantityAction } from "@/app/actions/cart";
import { readCartId } from "@/lib/cart-cookie";
import { fetchCart, MedusaError, type StoreCart } from "@/lib/medusa";
import { PromoCodeInput } from "@/components/promo-code-input";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bag" };

/** Line total from Medusa; falls back to unit price × quantity if the total was not returned. */
function lineTotal(item: { total?: number; unit_price: number; quantity: number }): number {
  return typeof item.total === "number" ? item.total : item.unit_price * item.quantity;
}

export default async function CartPage() {
  let cart: StoreCart | null = null;
  let error: string | null = null;

  try {
    const cartId = await readCartId();
    cart = cartId ? await fetchCart(cartId) : null;
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  const items = cart?.items ?? [];
  const empty = items.length === 0;

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <h1 className="type-headline-lg mb-sp-4 uppercase">Your bag</h1>

      {error ? (
        <div role="alert" className="border border-error px-6 py-8">
          <p className="font-display text-headline-sm text-error">Bag unavailable</p>
          <p className="mt-2 font-sans text-body-sm text-on-surface-variant">{error}</p>
        </div>
      ) : empty ? (
        <div className="border border-line px-6 py-12">
          <p className="font-display text-headline-sm uppercase">Nothing in the bag yet.</p>
          <p className="mt-2 max-w-[46ch] font-sans text-body-sm text-on-surface-variant">
            Sizes sell through quickly — start with the latest arrivals.
          </p>
          <Link
            href="/collections/all"
            className="mt-sp-3 inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
          >
            Shop all
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sp-5 lg:grid-cols-[1fr_360px]">
          <ul className="list-none divide-y divide-line p-0">
            {items.map((item) => (
              <li key={item.id} className="grid grid-cols-[96px_1fr] gap-sp-3 py-sp-3">
                <div className="aspect-[3/4] w-24 bg-surface-container">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.product_title ?? item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-display text-body-lg uppercase">
                        {item.product_title ?? item.title}
                      </span>
                      <span className="font-mono text-label-caps uppercase text-muted">
                        {item.variant_title ?? "One size"}
                      </span>
                    </div>
                    <Price value={moneyFromRupees(lineTotal(item))} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <form action={setQuantityAction} className="flex items-center gap-2">
                      <input type="hidden" name="lineId" value={item.id} />
                      <input type="hidden" name="quantity" value={item.quantity - 1} />
                      <button
                        type="submit"
                        aria-label={`Decrease quantity of ${item.product_title ?? item.title}`}
                        className="h-9 w-9 border border-line font-mono text-body-sm text-ink transition-colors hover:border-ink"
                      >
                        −
                      </button>
                    </form>

                    <span className="min-w-8 text-center font-mono text-body-sm tabular">
                      {item.quantity}
                    </span>

                    <form action={setQuantityAction}>
                      <input type="hidden" name="lineId" value={item.id} />
                      <input type="hidden" name="quantity" value={item.quantity + 1} />
                      <button
                        type="submit"
                        aria-label={`Increase quantity of ${item.product_title ?? item.title}`}
                        className="h-9 w-9 border border-line font-mono text-body-sm text-ink transition-colors hover:border-ink"
                      >
                        +
                      </button>
                    </form>

                    <form action={removeLineAction}>
                      <input type="hidden" name="lineId" value={item.id} />
                      <button
                        type="submit"
                        className="ml-2 font-mono text-label-caps uppercase text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit border border-line p-sp-3">
            <h2 className="mb-sp-3 font-mono text-label-caps uppercase text-muted">Summary</h2>
            <dl className="m-0 flex flex-col gap-2 font-sans text-body-sm">
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Item subtotal</dt>
                <dd className="m-0 tabular">
                  <Price value={moneyFromRupees(cart?.item_total ?? 0)} />
                </dd>
              </div>
              {(cart?.discount_total ?? 0) > 0 ? (
                <div className="flex justify-between text-emerald-600">
                  <dt>Promotion discount</dt>
                  <dd className="m-0 tabular">
                    −<Price value={moneyFromRupees(cart?.discount_total ?? 0)} />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Shipping</dt>
                <dd className="m-0 text-muted">Calculated at checkout</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-line pt-3">
                <div>
                  <dt className="font-mono text-label-caps uppercase text-ink">Total</dt>
                  <p className="font-mono text-[11px] text-muted m-0">Incl. of all taxes &amp; GST</p>
                </div>
                <dd className="m-0 text-right">
                  <Price value={moneyFromRupees(cart?.total ?? 0)} size="lg" />
                </dd>
              </div>
            </dl>

            <div className="mt-sp-3">
              <PromoCodeInput promotions={cart?.promotions} />
            </div>

            <Link
              href="/checkout"
              className="mt-sp-3 flex min-h-12 w-full items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              Checkout
            </Link>
            <p className="mt-2 font-sans text-body-sm text-muted">
              Prepaid only — UPI and cards, secured by Razorpay. Cash on Delivery is not offered.
            </p>

            <p className="mt-sp-3 font-sans text-body-sm text-muted">
              All prices in INR, inclusive of duties and GST.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
