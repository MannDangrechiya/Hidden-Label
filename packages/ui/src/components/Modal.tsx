"use client";

import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
}

/**
 * Additive primitive. DESIGN_TOKENS.md §4: 1px border, backdrop
 * `rgba(248,247,244,0.85)` with blur, no dark scrim, zero radius. Desktop: centred sheet.
 * Mobile derivation (§7 rule 4): full-width bottom sheet with a top border.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/85 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto border-t border-ink bg-white p-lg sm:max-w-md sm:border"
      >
        <div className="mb-md flex items-center justify-between gap-4 border-b border-line pb-md">
          <h2 className="font-display text-headline-sm uppercase">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-label-caps uppercase text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
