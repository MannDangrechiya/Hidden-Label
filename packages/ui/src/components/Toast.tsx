"use client";

export type ToastKind = "success" | "error" | "info";

export interface ToastProps {
  kind?: ToastKind;
  message: string;
  onDismiss?: () => void;
}

const BORDER: Record<ToastKind, string> = {
  success: "border-ink",
  error: "border-error",
  info: "border-line",
};

/**
 * Additive primitive — a single flat notice, not a floating "card with shadow". No drop
 * shadow per DESIGN_TOKENS.md §4; hierarchy comes from the 1px border alone.
 */
export function Toast({ kind = "info", message, onDismiss }: ToastProps) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={[
        "flex items-center justify-between gap-4 border bg-white px-4 py-3 font-sans text-body-sm text-ink",
        BORDER[kind],
      ].join(" ")}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="font-mono text-label-caps uppercase text-muted hover:text-ink"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
