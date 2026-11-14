"use client";

import { useEffect, type ReactNode } from "react";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: "left" | "right";
}

/**
 * Additive primitive — slide-in panel (cart drawer, mega menu, filter sheet). Same framing
 * rules as Modal (DESIGN_TOKENS.md §4): 1px border, blurred bone backdrop, zero radius.
 */
export function Drawer({ open, onClose, title, children, side = "right" }: DrawerProps) {
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
      className="fixed inset-0 z-50 bg-canvas/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={[
          "absolute top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-ink bg-white p-lg",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
        ].join(" ")}
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
