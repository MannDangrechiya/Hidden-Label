import Link from "next/link";
import CheckoutPage from "../page";
import { readCartId } from "@/lib/cart-cookie";
import { fetchCart } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment — Checkout" };

/**
 * Empty/aborted states for the dedicated payment step, in the same brutalist system as the rest
 * of checkout. They previously used an unrelated dark `neutral-950` + serif layout.
 */
function PaymentEmptyState({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-2 border-b border-line pb-sp-3">
        <p className="font-mono text-label-caps uppercase text-muted">Payment &amp; settlement</p>
        <h1 className="type-headline-lg uppercase">Checkout</h1>
        <nav aria-label="Checkout steps" className="flex gap-3 font-mono text-label-caps uppercase">
          <span className="text-muted">1. Address</span>
          <span aria-hidden="true">/</span>
          <span className="text-muted">2. Shipping</span>
          <span aria-hidden="true">/</span>
          <span className="text-ink">3. Payment</span>
        </nav>
      </header>

      <div className="border border-line px-6 py-12">
        <p className="font-display text-headline-sm uppercase">Nothing to pay for yet</p>
        <p className="mt-2 max-w-[46ch] font-sans text-body-sm text-on-surface-variant">{message}</p>
        <div className="mt-sp-3 flex flex-wrap gap-3">
          <Link
            href="/collections/all"
            className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
          >
            Explore the collection
          </Link>
          <Link
            href="/cart"
            className="inline-flex min-h-12 items-center justify-center border border-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline transition-colors hover:bg-ink hover:text-white"
          >
            View bag
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function CheckoutPaymentPage() {
  const cartId = await readCartId();
  if (!cartId) {
    return (
      <PaymentEmptyState message="No active bag was found. Choose your pieces first, then return here to pay." />
    );
  }

  const cart = await fetchCart(cartId).catch(() => null);
  if (!cart || cart.items.length === 0) {
    return <PaymentEmptyState message="Your bag is empty. Add a piece before completing payment." />;
  }

  return <CheckoutPage searchParams={Promise.resolve({ step: "payment" })} />;
}
