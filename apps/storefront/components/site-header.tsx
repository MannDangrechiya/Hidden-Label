import Link from "next/link";
import { CartDrawer } from "@/components/cart-drawer";
import { MegaMenu } from "@/components/mega-menu";
import { MobileNav } from "@/components/mobile-nav";
import { SearchOverlay } from "@/components/search-overlay";
import { readCartId } from "@/lib/cart-cookie";
import { fitStudioEnabled, resaleEnabled } from "@/lib/feature-flags";
import { fetchBrands, fetchCart, fetchCategories } from "@/lib/medusa";
import { getCurrentCustomer } from "@/lib/session";

/**
 * Global header per DESIGN_TOKENS.md §5: wordmark, monospaced utility nav, tabular bag count.
 * The bag count comes from the server-side cart, never from client state.
 *
 * MOBILE-02: below `sm` the header row is menu + wordmark + search + bag. The wordmark is the
 * only flexible item (`min-w-0` + `truncate`) so the utility controls can never be pushed past
 * the viewport edge — previously the cluster ended 14px outside a 320px viewport and the bag
 * count was clipped. Account/Wishlist move into the menu on phones, where they are full-width
 * rows instead of 16px-tall text, and every control keeps a 44px tap area.
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

  const [categories, brandsResult] = await Promise.all([
    fetchCategories().catch(() => []),
    fetchBrands().catch(() => ({ brands: [], count: 0 })),
  ]);

  const enableResale = resaleEnabled();
  const fitStudioOn = fitStudioEnabled();
  const nav = [
    { label: "Bespoke", href: "/collections/bespoke" },
    ...(fitStudioOn ? [{ label: "Fit Studio", href: "/fit-studio" }] : []),
    ...(enableResale ? [{ label: "Sell", href: "/sell" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-canvas/95 backdrop-blur-sm overflow-x-clip">
      <div className="mx-auto flex w-full max-w-page items-center justify-between gap-1 px-margin py-2 sm:gap-sp-3 sm:px-margin-tablet sm:py-4 lg:px-margin-desktop">
        <div className="flex min-w-0 items-center gap-1 sm:hidden">
          <MobileNav
            categories={categories}
            brands={brandsResult.brands}
            extraLinks={nav}
            signedIn={Boolean(session)}
          />
        </div>

        <Link
          href="/"
          className="flex min-h-11 min-w-0 flex-1 items-center truncate py-3 font-display text-[13px] uppercase tracking-[-0.02em] text-ink no-underline max-[360px]:text-[12px] sm:min-h-0 sm:flex-none sm:shrink-0 sm:whitespace-nowrap sm:py-0 sm:text-headline-sm"
        >
          The Hidden Label
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-sp-4 sm:flex">
          <MegaMenu categories={categories} brands={brandsResult.brands} />
          <Link
            href="/brands"
            className="font-mono text-label-caps uppercase text-on-surface-variant no-underline transition-colors hover:text-ink"
          >
            Brands
          </Link>
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

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-sp-3">
          <SearchOverlay />
          <Link
            href={session ? "/account/wishlist" : "/login"}
            className="hidden font-mono text-label-caps uppercase text-ink no-underline sm:inline"
          >
            Wishlist
          </Link>
          <Link
            href={session ? "/account" : "/login"}
            className="hidden max-w-[72px] truncate font-mono text-xs uppercase text-ink no-underline sm:inline-block sm:max-w-none sm:text-label-caps"
          >
            {session ? session.customer.first_name ?? "Account" : "Sign in"}
          </Link>
          <CartDrawer initialCount={count} />
        </div>
      </div>
    </header>
  );
}
