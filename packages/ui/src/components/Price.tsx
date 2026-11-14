import { formatINR, type Money } from "@thl/shared";

export interface PriceProps {
  value: Money | null;
  size?: "md" | "lg";
  className?: string;
}

/**
 * All money renders through this component: JetBrains Mono, tabular figures, Indian grouping.
 * A null value renders the honest fallback instead of a placeholder zero.
 */
export function Price({ value, size = "md", className = "" }: PriceProps) {
  const text = value ? formatINR(value) : "Price unavailable";
  const type = size === "lg" ? "text-currency-lg" : "text-currency-md";

  return (
    <span
      className={[type, "font-mono tabular", value ? "text-ink" : "text-muted", className]
        .filter(Boolean)
        .join(" ")}
    >
      {text}
    </span>
  );
}
