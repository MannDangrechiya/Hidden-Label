"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden border border-ink bg-ink px-5 py-2.5 font-mono text-label-caps uppercase text-white transition-colors hover:bg-accent hover:text-ink"
    >
      Print Invoice / Download PDF
    </button>
  );
}
