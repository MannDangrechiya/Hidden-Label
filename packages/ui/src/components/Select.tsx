import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Select counterpart to Input.tsx — same flat, bordered, zero-radius treatment. */
export function Select({ label, error, hint, className = "", children, ...rest }: SelectProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-label-caps uppercase text-on-surface-variant">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "w-full min-w-0 bg-surface px-3 py-3 font-sans text-body-md text-ink",
          "border rounded-none outline-none transition-colors",
          error ? "border-error" : "border-line focus:border-ink",
          "disabled:bg-line disabled:text-muted disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="font-sans text-body-sm text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="font-sans text-body-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
