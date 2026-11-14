import { SkeletonCard } from "@thl/ui";

/** Loading state for the catalogue: mirrors the final grid so nothing shifts when data lands. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-page px-margin py-lg sm:px-margin-tablet lg:px-margin-desktop">
      <header className="mb-xl flex flex-col gap-2 border-b border-line pb-md">
        <h1 className="type-headline-lg uppercase">The Hidden Label</h1>
        <p className="font-mono text-label-caps uppercase text-muted">Loading catalogue…</p>
      </header>
      <ul className="grid list-none grid-cols-2 gap-gutter p-0 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index}>
            <SkeletonCard />
          </li>
        ))}
      </ul>
    </main>
  );
}
