import Link from "next/link";
import { SearchOverlay } from "@/components/search-overlay";
import { readCartId } from "@/lib/cart-cookie";
import { fetchCart } from "@/lib/medusa";
import { getCurrentCustomer } from "@/lib/session";

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

  const session = await getCurrentCustomer().catch(() => null);

  const nav = [
    { label: "Shop", href: "/collections/all" },
    { label: "Brands", href: "/brands" },
    { label: "Sell", href: "/sell" },
    { label: "Fit Studio", href: "/fit-studio" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-canvas/95 backdrop-blur-sm overflow-x-clip">
      <div className="mx-auto flex w-full max-w-page items-center justify-between gap-2 px-margin py-3 sm:gap-sp-3 sm:px-margin-tablet sm:py-4 lg:px-margin-desktop">
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap font-display text-[13px] uppercase tracking-[-0.02em] text-ink no-underline sm:text-headline-sm"
        >
          The Hidden Label
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-sp-4 sm:flex">
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

        <div className="flex items-center gap-2 sm:gap-sp-3 shrink-0">
          <SearchOverlay />
          <Link
            href={session ? "/account/wishlist" : "/login"}
            className="hidden font-mono text-label-caps uppercase text-ink no-underline sm:inline"
          >
            Wishlist
          </Link>
          <Link
            href={session ? "/account" : "/login"}
            className="max-w-[72px] sm:max-w-none truncate font-mono text-xs sm:text-label-caps uppercase text-ink no-underline"
          >
            {session ? session.customer.first_name ?? "Account" : "Sign in"}
          </Link>
          <Link
            href="/cart"
            className="whitespace-nowrap font-mono text-xs sm:text-label-caps uppercase text-ink no-underline"
            aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}
          >
            Bag <span className="tabular">({count})</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
