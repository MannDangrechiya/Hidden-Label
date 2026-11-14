import { money, moneyFromRupees } from "@thl/shared";
import { Badge, Button, EmptyState, ErrorState, Input, Price, ProductCard, SkeletonCard } from "@thl/ui";

/**
 * Design-system gallery (G1 review surface). Renders every primitive and every state at mobile,
 * tablet and desktop widths so token drift is visible side by side.
 * Not linked from the storefront and marked noindex.
 */
export const metadata = {
  title: "Design system — The Hidden Label",
  robots: { index: false, follow: false },
};

const WIDTHS = [
  { label: "mobile · 375", width: 375 },
  { label: "tablet · 768", width: 768 },
  { label: "desktop · 1200", width: 1200 },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-sp-5 flex flex-col gap-sp-3">
      <h2 className="border-b border-line pb-2 font-mono text-label-caps uppercase text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-4 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-5 flex flex-col gap-2 border-b border-ink pb-sp-3">
        <h1 className="font-display type-display-hero uppercase">The Hidden Label</h1>
        <p className="font-mono text-label-caps uppercase text-muted">
          Design system · tokens from docs/DESIGN_TOKENS.md
        </p>
      </header>

      <Section title="Type scale">
        <div className="flex flex-col gap-3">
          <p className="font-display type-display-hero">Display hero</p>
          <p className="font-display type-headline-lg">Headline large</p>
          <p className="font-display text-headline-md">Headline medium</p>
          <p className="font-display text-headline-sm">Headline small</p>
          <p className="font-sans text-body-lg">Body large — Hanken Grotesk, 18/28.</p>
          <p className="font-sans text-body-md">Body medium — the workhorse for product copy.</p>
          <p className="font-sans text-body-sm text-on-surface-variant">Body small — metadata.</p>
          <p className="font-mono text-label-caps uppercase text-muted">
            Label caps · 11px · 0.12em tracking
          </p>
        </div>
      </Section>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-sp-2 sm:grid-cols-4">
          {[
            ["canvas", "bg-canvas border border-line"],
            ["surface-container", "bg-surface-container"],
            ["ink", "bg-ink"],
            ["accent", "bg-accent"],
            ["muted", "bg-muted"],
            ["line", "bg-line"],
            ["error", "bg-error"],
            ["error-container", "bg-error-container"],
          ].map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-16 w-full ${cls}`} />
              <span className="font-mono text-label-caps text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-sp-3">
          <Button>Add to bag</Button>
          <Button variant="secondary">Select size</Button>
          <Button disabled>Sold out</Button>
          <Button loading>Processing</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-sp-3 sm:grid-cols-2">
          <Input label="Email" placeholder="you@example.com" hint="Order updates go here." />
          <Input label="Pincode" placeholder="400001" error="Not serviceable yet." />
        </div>
      </Section>

      <Section title="Price & badges">
        <div className="flex flex-wrap items-center gap-sp-3">
          <Price value={moneyFromRupees(38990)} size="lg" />
          <Price value={money(12345)} />
          <Price value={null} />
          <Badge kind="low_stock" />
          <Badge kind="last_one" />
          <Badge kind="new_in" />
          <Badge kind="sold_out" />
        </div>
      </Section>

      <Section title="Responsive product grid">
        <div className="flex flex-col gap-sp-4">
          {WIDTHS.map(({ label, width }) => (
            <div key={label} className="flex flex-col gap-2">
              <span className="font-mono text-label-caps uppercase text-muted">{label}</span>
              <div className="border border-line-warm bg-surface p-3" style={{ maxWidth: width }}>
                <div className="grid grid-cols-2 gap-gutter sm:grid-cols-3">
                  <ProductCard
                    brand="Nike"
                    title="Air Jordan 1 Retro High OG"
                    price={moneyFromRupees(38990)}
                    imageUrl={null}
                    badge="low_stock"
                  />
                  <ProductCard
                    brand="Adidas"
                    title="Samba OG 'Cloud White'"
                    price={moneyFromRupees(12999)}
                    imageUrl={null}
                    soldOut
                  />
                  <ProductCard
                    brand={null}
                    title="Product without brand metadata"
                    price={null}
                    imageUrl={null}
                  />
                  <SkeletonCard />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Empty & error states">
        <div className="grid gap-sp-3 lg:grid-cols-2">
          <EmptyState
            title="No products match"
            description="Try removing a filter or browsing all brands."
            action={
              <Button variant="secondary" className="mt-2">
                Clear filters
              </Button>
            }
          />
          <ErrorState message="We could not reach the catalogue. Check your connection and try again." />
        </div>
      </Section>
    </main>
  );
}
