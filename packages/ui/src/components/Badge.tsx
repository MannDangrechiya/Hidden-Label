import type { ReactNode } from "react";

export type BadgeKind = "low_stock" | "last_one" | "new_in" | "sold_out";

export interface BadgeProps {
  kind: BadgeKind;
  children?: ReactNode;
}

/**
 * DESIGN_TOKENS.md §5 with the v1 constraint from decisions D1/D2: only badges backed by real
 * data exist. There is deliberately no "verified"/"deadstock" variant — those are V2 and must
 * not render in v1.
 */
const styles: Record<BadgeKind, string> = {
  low_stock: "bg-ink text-white",
  last_one: "bg-ink text-white",
  new_in: "border border-ink text-ink",
  sold_out: "bg-line text-muted",
};

const defaults: Record<BadgeKind, string> = {
  low_stock: "Low stock",
  last_one: "Last one",
  new_in: "New in",
  sold_out: "Sold out",
};

export function Badge({ kind, children }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2 py-1 font-sans text-label-tag",
        styles[kind],
      ].join(" ")}
    >
      {children ?? defaults[kind]}
    </span>
  );
}
