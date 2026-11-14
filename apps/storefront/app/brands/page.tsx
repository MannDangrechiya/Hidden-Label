import { EmptyState, ErrorState } from "@thl/ui";
import Link from "next/link";
import { fetchBrands, MedusaError, type StoreBrand } from "@/lib/medusa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brands" };

function groupByLetter(brands: StoreBrand[]): Map<string, StoreBrand[]> {
  const groups = new Map<string, StoreBrand[]>();
  for (const brand of brands) {
    const letter = brand.name.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    const bucket = groups.get(key) ?? [];
    bucket.push(brand);
    groups.set(key, bucket);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export default async function BrandsPage() {
  let brands: StoreBrand[] = [];
  let error: string | null = null;

  try {
    const data = await fetchBrands();
    brands = data.brands;
  } catch (caught) {
    error =
      caught instanceof MedusaError
        ? caught.message
        : `Unexpected error: ${caught instanceof Error ? caught.message : String(caught)}`;
  }

  const grouped = groupByLetter(brands);

  return (
    <main className="mx-auto w-full max-w-page px-margin py-sp-5 sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-sp-4 flex flex-col gap-2 border-b border-line pb-sp-3">
        <h1 className="type-headline-lg uppercase">Brand directory</h1>
        <p className="font-mono text-label-caps uppercase text-muted">
          {error ? "Directory unavailable" : `${brands.length} brand${brands.length === 1 ? "" : "s"}`}
        </p>
      </header>

      {error ? (
        <ErrorState title="Could not load the brand directory" message={error} />
      ) : brands.length === 0 ? (
        <EmptyState
          title="No brands yet"
          description="Brands will appear here once they are added in the admin."
          action={
            <Link
              href="/collections/all"
              className="inline-flex min-h-12 items-center justify-center bg-ink px-6 py-3 font-mono text-label-caps uppercase tracking-[0.12em] text-white no-underline transition-colors hover:bg-accent hover:text-ink"
            >
              Shop all
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-sp-5">
          {/* A–Z anchor matrix per U-03 */}
          <nav aria-label="Jump to letter" className="flex flex-wrap gap-2 border-b border-line pb-sp-3">
            {[...grouped.keys()].map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="flex h-8 w-8 items-center justify-center border border-line font-mono text-label-caps text-ink no-underline hover:border-ink"
              >
                {letter}
              </a>
            ))}
          </nav>

          {[...grouped.entries()].map(([letter, group]) => (
            <section key={letter} id={`letter-${letter}`} aria-labelledby={`letter-${letter}-heading`}>
              <h2
                id={`letter-${letter}-heading`}
                className="mb-sp-3 font-display text-headline-sm uppercase text-muted"
              >
                {letter}
              </h2>
              <ul className="grid list-none grid-cols-1 gap-gutter p-0 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((brand) => (
                  <li key={brand.id}>
                    <Link
                      href={`/brands/${brand.handle}`}
                      className="group flex flex-col gap-2 border border-line p-sp-3 no-underline transition-colors hover:border-ink"
                    >
                      <span className="font-display text-headline-sm uppercase text-ink">{brand.name}</span>
                      {brand.tagline ? (
                        <span className="font-sans text-body-sm text-on-surface-variant">{brand.tagline}</span>
                      ) : null}
                      <span className="font-mono text-label-caps uppercase text-muted">
                        {brand.product_count ?? 0} item{brand.product_count === 1 ? "" : "s"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
