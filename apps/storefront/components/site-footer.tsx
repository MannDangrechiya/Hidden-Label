import Link from "next/link";
import { fitStudioEnabled, resaleEnabled } from "@/lib/feature-flags";

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
            {/* GAP-TAX-03: the statutory identifiers are published, not hidden on invoices. */}
            <p className="mt-2">
              GSTIN: {process.env.BUSINESS_GSTIN ?? "—"} · CIN: {process.env.BUSINESS_CIN ?? "—"}
            </p>
          </div>
        </div>

        <nav aria-label="Shop" className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">Shop</span>
          <Link href="/collections/all" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            All Products
          </Link>
          <Link href="/collections/bespoke" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Custom Bespoke Studio
          </Link>
          <Link href="/collections/footwear" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Footwear &amp; Sneakers
          </Link>
          <Link href="/collections/menswear" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Menswear
          </Link>
          <Link href="/brands" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Brands Vault
          </Link>
          {resaleEnabled() ? (
            <Link href="/sell" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
              Sell / Consign
            </Link>
          ) : null}
          {fitStudioEnabled() ? (
            <Link href="/fit-studio" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
              Fit Studio
            </Link>
          ) : null}
        </nav>

        <nav aria-label="The House" className="flex flex-col gap-2">
          <span className="font-mono text-label-caps uppercase text-white/60">The House</span>
          <Link href="/about" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            About The House
          </Link>
          <Link href="/authenticity" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Authenticity Protocol
          </Link>
          <Link href="/size-guide" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Size &amp; Fit Guide
          </Link>
          <Link href="/support" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Client Support &amp; FAQ
          </Link>
          <Link href="/account/orders" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
            Track an Order
          </Link>
          <Link href="/account/returns" className="inline-flex min-h-9 items-center font-sans text-body-sm text-white no-underline hover:underline">
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
            <Link href="/policies/grievance" className="font-sans text-body-sm text-white/80 no-underline hover:underline">
              Grievance Officer
            </Link>
          </div>

          {/* GAP-SUP-02: the statutory officer and SLA are visible on every page. */}
          <div className="border-t border-white/10 pt-2 flex flex-col gap-0.5">
            <span className="font-mono text-label-caps uppercase text-white/60">
              Grievance Officer
            </span>
            <span className="font-mono text-body-xs text-white/70">
              {process.env.GRIEVANCE_OFFICER_NAME ?? "Grievance Officer"}
            </span>
            <a
              href={`mailto:${process.env.GRIEVANCE_OFFICER_EMAIL ?? "grievance@thehiddenlabel.com"}`}
              className="font-mono text-body-xs text-white/70 underline-offset-2 hover:underline"
            >
              {process.env.GRIEVANCE_OFFICER_EMAIL ?? "grievance@thehiddenlabel.com"}
            </a>
            <span className="font-mono text-body-xs text-white/50">
              Acknowledged in 48h · resolved in 30 days
            </span>
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
