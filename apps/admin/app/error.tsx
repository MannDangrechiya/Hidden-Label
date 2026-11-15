"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@thl/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin dashboard error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="max-w-md border border-error bg-surface p-8">
        <span className="font-mono text-xs uppercase tracking-widest text-error">
          Admin Console Interruption
        </span>
        <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
          Internal Exception
        </h1>
        <p className="mt-3 font-sans text-body-sm text-on-surface-variant leading-relaxed">
          The administrative action encountered an unexpected error.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} variant="primary">
            Retry Action
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-line bg-surface px-6 font-mono text-label-caps uppercase text-ink no-underline transition-colors hover:border-ink"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
