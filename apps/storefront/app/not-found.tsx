import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-page flex-col items-center justify-center px-margin py-sp-5 text-center sm:px-margin-tablet lg:px-margin-desktop">
      <div className="max-w-md border border-ink bg-surface p-8">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          Error 404
        </span>
        <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
          Specimen Not Found
        </h1>
        <p className="mt-3 font-sans text-body-sm text-on-surface-variant leading-relaxed">
          The requested silhouette, editorial page, or acquisition record does not exist in The Vault archive.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-6 font-mono text-label-caps uppercase text-white no-underline transition-colors hover:bg-ink/90"
          >
            Storefront
          </Link>
          <Link
            href="/collections/all"
            className="inline-flex min-h-11 items-center justify-center border border-line bg-surface px-6 font-mono text-label-caps uppercase text-ink no-underline transition-colors hover:border-ink"
          >
            Explore Catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
