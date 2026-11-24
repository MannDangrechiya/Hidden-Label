"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StoreCategoryNode } from "@/lib/medusa";

interface Brand {
  id: string;
  name: string;
  handle: string;
}

export interface MobileNavLink {
  label: string;
  href: string;
}

/**
 * MOBILE-01: below the `sm` breakpoint the primary navigation (`Shop`/`Brands`/`Bespoke`) used to
 * disappear entirely — there was no replacement, so every catalogue, brand and bespoke entry
 * point was unreachable on a phone. This is that replacement: a real menu button plus a
 * full-screen sheet in the same brutalist system as the rest of the site.
 *
 * Accessibility contract:
 *  - the trigger exposes `aria-expanded` / `aria-controls` and an accessible name;
 *  - Escape closes the sheet and returns focus to the trigger;
 *  - opening moves focus into the sheet and traps Tab inside it;
 *  - background scrolling is locked while open;
 *  - every destination closes the sheet, including a same-route navigation;
 *  - rows are full-width with a 44px+ tap target and the sheet honours safe-area insets.
 */
export function MobileNav({
  categories,
  brands,
  extraLinks,
  signedIn,
}: {
  categories: StoreCategoryNode[];
  brands: Brand[];
  extraLinks: MobileNavLink[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // The panel must escape the header: `backdrop-blur` on the sticky header makes it the
  // containing block for `position: fixed` descendants, which collapsed the full-screen sheet
  // to the height of the header row. Rendering into a body portal keeps it viewport-sized.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigating (even to the current route) must leave the menu closed behind it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      // Keep keyboard focus inside the sheet while it is modal.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label="Open menu"
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center border-0 bg-transparent text-ink sm:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="square" />
        </svg>
      </button>

      {open && mounted
        ? createPortal(
            <div
              id="mobile-nav-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-0 z-[60] flex flex-col bg-canvas sm:hidden"
            >
          <div className="flex items-center justify-between border-b border-ink px-margin py-3">
            <span className="font-display text-[13px] uppercase tracking-[-0.02em] text-ink">
              The Hidden Label
            </span>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="-mr-2 flex h-11 w-11 items-center justify-center border-0 bg-transparent text-ink"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="square" />
              </svg>
            </button>
          </div>

          <nav
            aria-label="Mobile"
            className="flex-1 overflow-y-auto overscroll-contain px-margin"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <ul className="m-0 flex list-none flex-col p-0">
              <li className="border-b border-line">
                <Link
                  href="/collections/all"
                  onClick={close}
                  className="flex min-h-12 items-center font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline"
                >
                  Shop all
                </Link>
              </li>
              {extraLinks.map((item) => (
                <li key={item.href} className="border-b border-line">
                  <Link
                    href={item.href}
                    onClick={close}
                    className="flex min-h-12 items-center font-mono text-label-caps uppercase tracking-[0.12em] text-ink no-underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            {categories.length > 0 ? (
              <section className="border-b border-line py-sp-3">
                <h2 className="m-0 mb-2 font-mono text-label-caps uppercase text-muted">
                  Shop by category
                </h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/collections/all?category=${encodeURIComponent(category.handle)}`}
                        onClick={close}
                        className="flex min-h-11 items-center font-sans text-body-md text-ink no-underline"
                      >
                        {category.name}
                        {category.product_count > 0 ? (
                          <span className="ml-1 font-mono text-label-caps text-muted">
                            ({category.product_count})
                          </span>
                        ) : null}
                      </Link>
                      {category.children.length > 0 ? (
                        <ul className="m-0 mb-2 flex list-none flex-col p-0 pl-3">
                          {category.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/collections/all?category=${encodeURIComponent(child.handle)}`}
                                onClick={close}
                                className="flex min-h-11 items-center font-sans text-body-sm text-on-surface-variant no-underline"
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {brands.length > 0 ? (
              <section className="border-b border-line py-sp-3">
                <h2 className="m-0 mb-2 font-mono text-label-caps uppercase text-muted">Brands</h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {brands.slice(0, 12).map((brand) => (
                    <li key={brand.id}>
                      <Link
                        href={`/brands/${brand.handle}`}
                        onClick={close}
                        className="flex min-h-11 items-center font-sans text-body-md text-ink no-underline"
                      >
                        {brand.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="py-sp-3">
              <h2 className="m-0 mb-2 font-mono text-label-caps uppercase text-muted">Account</h2>
              <ul className="m-0 flex list-none flex-col p-0">
                <li>
                  <Link
                    href={signedIn ? "/account" : "/login"}
                    onClick={close}
                    className="flex min-h-11 items-center font-sans text-body-md text-ink no-underline"
                  >
                    {signedIn ? "Your account" : "Sign in"}
                  </Link>
                </li>
                <li>
                  <Link
                    href={signedIn ? "/account/orders" : "/login"}
                    onClick={close}
                    className="flex min-h-11 items-center font-sans text-body-md text-ink no-underline"
                  >
                    Orders
                  </Link>
                </li>
                <li>
                  <Link
                    href={signedIn ? "/account/wishlist" : "/login"}
                    onClick={close}
                    className="flex min-h-11 items-center font-sans text-body-md text-ink no-underline"
                  >
                    Wishlist
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cart"
                    onClick={close}
                    className="flex min-h-11 items-center font-sans text-body-md text-ink no-underline"
                  >
                    Bag
                  </Link>
                </li>
              </ul>
            </section>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
