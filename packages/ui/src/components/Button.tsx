import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

/**
 * DESIGN_TOKENS.md §5: primary is ink fill with white caps type, inverting to gold on hover;
 * secondary is a 1px ink border; disabled is `#E4E4E7` with muted type and no hover change.
 * Radius is 0 — always.
 */
const base =
  "inline-flex items-center justify-center gap-2 px-6 py-3 font-mono text-label-caps uppercase " +
  "tracking-[0.12em] transition-colors duration-150 select-none focus-visible:outline-none " +
  "focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white enabled:hover:bg-accent enabled:hover:text-ink",
  secondary: "border border-ink text-ink bg-transparent enabled:hover:bg-ink enabled:hover:text-white",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        base,
        isDisabled ? "bg-line text-muted cursor-not-allowed border border-transparent" : variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-3 w-3 animate-spin border border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
