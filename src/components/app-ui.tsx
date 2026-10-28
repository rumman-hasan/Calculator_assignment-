import type { ReactNode } from "react";
import { roleLabels, type Role } from "@/lib/roles";
import { titleCase } from "@/lib/format";

/** Shared building blocks for the admin dashboard and the client portal (light theme). */

export function PageHeader({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 print:mb-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {text && <p className="mt-2 max-w-2xl text-sm text-slate-600">{text}</p>}
      </div>
      {children}
    </div>
  );
}

export function Flash({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  if (searchParams.error) {
    return (
      <p role="alert" className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        {searchParams.error}
      </p>
    );
  }
  if (searchParams.ok) {
    return (
      <p role="status" className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {searchParams.ok}
      </p>
    );
  }
  return null;
}

const tones: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  draft: "bg-slate-100 text-slate-700",
  planning: "bg-slate-100 text-slate-700",
  contacted: "bg-sky-100 text-sky-800",
  in_progress: "bg-sky-100 text-sky-800",
  sent: "bg-sky-100 text-sky-800",
  pending: "bg-sky-100 text-sky-800",
  qualified: "bg-amber-100 text-amber-800",
  review: "bg-amber-100 text-amber-800",
  partial: "bg-amber-100 text-amber-800",
  on_hold: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  lost: "bg-red-100 text-red-800",
  spam: "bg-red-100 text-red-800",
  admin: "bg-blue-100 text-blue-800",
  staff: "bg-sky-100 text-sky-800",
  designer: "bg-violet-100 text-violet-800",
  client: "bg-slate-100 text-slate-700",
};

const labels: Record<string, string> = {
  ...roleLabels,
  partial: "Partially paid",
  in_progress: "In progress",
  on_hold: "On hold",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[value] ?? "bg-slate-100 text-slate-700"}`}>
      {labels[value as Role] ?? labels[value] ?? titleCase(value)}
    </span>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  placeholder,
  textarea = false,
  rows = 3,
  min,
  max,
  step,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  step?: number | string;
  children?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required ? " *" : ""}
      </label>
      {children ??
        (textarea ? (
          <textarea id={name} name={name} rows={rows} required={required} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="input" />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            required={required}
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            className="input"
          />
        ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="label !mb-2">{label}</p>
      <p className="font-display text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div className="h-full rounded-full bg-brand-royal" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-slate-500">{v}%</span>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-slate-500">
        {text}
      </td>
    </tr>
  );
}
