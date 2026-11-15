"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@thl/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront error boundary caught:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-page flex-col items-center justify-center px-margin py-sp-5 text-center sm:px-margin-tablet lg:px-margin-desktop">
      <div className="max-w-md border border-error bg-surface p-8">
        <span className="font-mono text-xs uppercase tracking-widest text-error">
          System Interruption
        </span>
        <h1 className="mt-2 font-display text-headline-lg uppercase text-ink">
          Operational Fault
        </h1>
        <p className="mt-3 font-sans text-body-sm text-on-surface-variant leading-relaxed">
          An unexpected interruption occurred while communicating with the commerce cluster.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} variant="primary">
            Retry Transaction
          </Button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center border border-line bg-surface px-6 font-mono text-label-caps uppercase text-ink no-underline transition-colors hover:border-ink"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
