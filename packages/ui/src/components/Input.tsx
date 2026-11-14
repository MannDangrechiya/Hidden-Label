import { useId, type InputHTMLAttributes } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * DESIGN_TOKENS.md §5: flat surface, 1px frame, no radius, no shadow, monospaced floating
 * label; focus switches the border to ink. Error text is a real element with aria-describedby,
 * not a colour change.
 */
export function Input({ label, error, hint, className = "", ...rest }: InputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-label-caps uppercase text-on-surface-variant"
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "w-full bg-surface px-3 py-3 font-sans text-body-md text-ink",
          "border rounded-none outline-none transition-colors placeholder:text-muted",
          error ? "border-error" : "border-line focus:border-ink",
          "disabled:bg-line disabled:text-muted disabled:cursor-not-allowed",
          className,
        ].join(" ")}
        {...rest}
      />
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
