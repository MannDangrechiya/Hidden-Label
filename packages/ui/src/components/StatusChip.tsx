import type { ReactNode } from "react";

export type StatusTone = "neutral" | "positive" | "warning" | "critical";

export interface StatusChipProps {
  tone: StatusTone;
  children: ReactNode;
}

/**
 * Admin status chip primitive (added for `apps/admin`; SYS-01 "dark ops palette, status chips").
 * No new colours: positive/warning/critical map to the documented ink/accent/error tokens so the
 * admin app stays on the single styling surface (`packages/ui`) per agent/RULES.md.
 */
const styles: Record<StatusTone, string> = {
  neutral: "border border-line text-on-surface-variant",
  positive: "bg-ink text-white",
  warning: "border border-accent text-ink",
  critical: "bg-error text-white",
};

export function StatusChip({ tone, children }: StatusChipProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-1 font-mono text-label-caps uppercase",
        styles[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
