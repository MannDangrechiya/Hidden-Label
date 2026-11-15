import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="max-w-md border border-line bg-surface p-8">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          Admin Error 404
        </span>
        <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
          Record Not Found
        </h1>
        <p className="mt-3 font-sans text-body-sm text-on-surface-variant leading-relaxed">
          The requested administrative resource, order, or entity does not exist in the platform registry.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-ink bg-ink px-6 font-mono text-label-caps uppercase text-white no-underline transition-colors hover:bg-ink/90"
          >
            Dashboard Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
