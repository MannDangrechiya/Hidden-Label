import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-sp-5 border-t border-ink bg-ink text-white">
      <div className="mx-auto grid w-full max-w-page gap-sp-4 px-margin py-sp-5 sm:grid-cols-2 sm:px-margin-tablet lg:grid-cols-4 lg:px-margin-desktop">
        <div className="flex flex-col gap-2">
          <span className="font-display text-headline-sm uppercase">The Hidden Label</span>
          <span className="font-sans text-body-sm text-white/70">
            Omnichannel luxury fashion house &amp; multi-brand streetwear boutique.
          </span>
          <div className="mt-2 font-mono text-xs text-white/60">
            <p>Steller, 205, 2nd Floor,</p>
            <p>Sindhu Bhavan Road, Bodakdev,</p>
            <p>Ahmedabad, Gujarat 380059</p>
          </div>
        </div>

        <nav aria-label="Shop" className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">Shop</span>
          <Link href="/collections/all" className="font-sans text-body-sm text-white no-underline hover:underline">
            All Products
          </Link>
          <Link href="/collections/bespoke" className="font-sans text-body-sm text-white no-underline hover:underline">
            Custom Bespoke Studio
          </Link>
          <Link href="/collections/footwear" className="font-sans text-body-sm text-white no-underline hover:underline">
            Footwear &amp; Sneakers
          </Link>
          <Link href="/collections/menswear" className="font-sans text-body-sm text-white no-underline hover:underline">
            Menswear
          </Link>
          <Link href="/brands" className="font-sans text-body-sm text-white no-underline hover:underline">
            Brands Vault
          </Link>
          <Link href="/sell" className="font-sans text-body-sm text-white no-underline hover:underline">
            Sell / Consign
          </Link>
          <Link href="/fit-studio" className="font-sans text-body-sm text-white no-underline hover:underline">
            Fit Studio (AI-04)
          </Link>
        </nav>

        <nav aria-label="The House" className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">The House</span>
          <Link href="/about" className="font-sans text-body-sm text-white no-underline hover:underline">
            About The House
          </Link>
          <Link href="/authenticity" className="font-sans text-body-sm text-white no-underline hover:underline">
            Authenticity Protocol
          </Link>
          <Link href="/size-guide" className="font-sans text-body-sm text-white no-underline hover:underline">
            Size &amp; Fit Guide
          </Link>
          <Link href="/support" className="font-sans text-body-sm text-white no-underline hover:underline">
            Client Support &amp; FAQ
          </Link>
          <Link href="/account/orders" className="font-sans text-body-sm text-white no-underline hover:underline">
            Track an Order
          </Link>
          <Link href="/account/orders" className="font-sans text-body-sm text-white no-underline hover:underline">
            Return Request
          </Link>
        </nav>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-label-caps uppercase text-white/60">Legal &amp; Policies</span>
            <Link href="/policies/shipping" className="font-sans text-body-sm text-white/80 no-underline hover:underline">
              Shipping &amp; Delivery
            </Link>
            <Link href="/policies/returns" className="font-sans text-body-sm text-white/80 no-underline hover:underline">
              Returns &amp; Refunds
            </Link>
            <Link href="/policies/terms" className="font-sans text-body-sm text-white/80 no-underline hover:underline">
              Terms of Service
            </Link>
            <Link href="/policies/privacy" className="font-sans text-body-sm text-white/80 no-underline hover:underline">
              Privacy Policy
            </Link>
          </div>

          <div className="border-t border-white/10 pt-2 flex flex-col gap-1">
            <span className="font-mono text-label-caps uppercase text-white/60">Currency</span>
            <span className="font-mono text-body-xs text-white/70">
              All transactions in INR (₹), inclusive of duties &amp; GST.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
