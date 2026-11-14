import type { ReactNode } from "react";

/** Loading: mirrors the final layout so the page does not jump when data arrives. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={["animate-pulse bg-surface-high", className].join(" ")} />;
}

export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3.5 w-20" />
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Empty: always offers a route out, never a dead end. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-start gap-3 border border-line px-6 py-10">
      <h2 className="font-display text-headline-sm">{title}</h2>
      {description ? (
        <p className="max-w-[60ch] font-sans text-body-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action}
    </section>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

/** Error: a human sentence and a retry affordance — never a stack trace or status code alone. */
export function ErrorState({ title = "Something went wrong", message, action }: ErrorStateProps) {
  return (
    <section
      role="alert"
      className="flex flex-col items-start gap-3 border border-error px-6 py-10"
    >
      <h2 className="font-display text-headline-sm text-error">{title}</h2>
      <p className="max-w-[60ch] font-sans text-body-sm text-on-surface-variant">{message}</p>
      {action}
    </section>
  );
}
