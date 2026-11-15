import Link from "next/link";
import CheckoutPage from "../page";
import { readCartId } from "@/lib/cart-cookie";
import { fetchCart } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment — Checkout" };

export default async function CheckoutPaymentPage() {
  const cartId = await readCartId();
  if (!cartId) {
    return (
      <main className="min-h-[60vh] bg-neutral-950 px-4 py-16 text-neutral-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-400">Step 3 of 3</span>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-white sm:text-4xl">Payment</h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">
            Dedicated payment step. No active shopping bag found. Please select pieces to proceed to payment.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/collections/all"
              className="inline-flex items-center justify-center border border-white/20 bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-neutral-200"
            >
              Explore Collection
            </Link>
            <Link
              href="/cart"
              className="inline-flex items-center justify-center border border-neutral-700 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-300 transition hover:border-white hover:text-white"
            >
              View Bag
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const cart = await fetchCart(cartId).catch(() => null);
  if (!cart || cart.items.length === 0) {
    return (
      <main className="min-h-[60vh] bg-neutral-950 px-4 py-16 text-neutral-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-400">Step 3 of 3</span>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-white sm:text-4xl">Payment</h1>
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">
            Your shopping bag is empty. Please add pieces before completing payment.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/collections/all"
              className="inline-flex items-center justify-center border border-white/20 bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-neutral-200"
            >
              Explore Collection
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <CheckoutPage searchParams={Promise.resolve({ step: "payment" })} />;
}
