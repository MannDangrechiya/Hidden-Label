export function SiteFooter() {
  return (
    <footer className="mt-xl border-t border-ink bg-ink text-white">
      <div className="mx-auto grid w-full max-w-page gap-lg px-margin py-xl sm:grid-cols-2 sm:px-margin-tablet lg:grid-cols-4 lg:px-margin-desktop">
        <div className="flex flex-col gap-2">
          <span className="font-display text-headline-sm uppercase">The Hidden Label</span>
          <span className="font-sans text-body-sm text-white/70">
            Curated multi-brand footwear and apparel.
          </span>
        </div>

        <nav aria-label="Shop" className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">Shop</span>
          <a href="/collections/all" className="font-sans text-body-sm text-white no-underline">
            All products
          </a>
        </nav>

        <nav aria-label="Support" className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">Support</span>
          <a href="/policies/shipping" className="font-sans text-body-sm text-white no-underline">
            Shipping
          </a>
          <a href="/policies/returns" className="font-sans text-body-sm text-white no-underline">
            Returns
          </a>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">Currency</span>
          <span className="font-mono text-body-sm text-white/70">
            All transactions in INR (₹), inclusive of duties &amp; GST.
          </span>
        </div>
      </div>
    </footer>
  );
}
