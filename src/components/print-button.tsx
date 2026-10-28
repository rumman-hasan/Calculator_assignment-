"use client";

/** Opens the browser's print dialog (choose "Save as PDF" there for a PDF copy of this page). */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-outline btn-sm">
      {label}
    </button>
  );
}
