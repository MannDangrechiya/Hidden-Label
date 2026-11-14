import Link from "next/link";
import { readCartId } from "@/lib/cart-cookie";
import { fetchCart } from "@/lib/medusa";

/**
 * Global header per DESIGN_TOKENS.md §5: wordmark, monospaced utility nav, tabular bag count.
 * The bag count comes from the server-side cart, never from client state.
 */
export async function SiteHeader() {
  let count = 0;
  try {
    const cartId = await readCartId();
    const cart = cartId ? await fetchCart(cartId) : null;
    count = cart?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0;
  } catch {
    count = 0;
  }

  const nav = [
    { label: "Shop", href: "/collections/all" },
    { label: "Brands", href: "/collections/all" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-page items-center justify-between gap-md px-margin py-4 sm:px-margin-tablet lg:px-margin-desktop">
        <Link
          href="/"
          className="font-display text-headline-sm uppercase tracking-[-0.02em] text-ink no-underline"
        >
          The Hidden Label
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-lg sm:flex">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="font-mono text-label-caps uppercase text-on-surface-variant no-underline transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-md">
          <Link
            href="/cart"
            className="font-mono text-label-caps uppercase text-ink no-underline"
            aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}
          >
            Bag <span className="tabular">({count})</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
