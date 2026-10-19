import type { ReactNode } from "react";

export const inputClass =
  "mt-1 block w-full rounded-lg border border-charcoal-200 bg-white px-3 py-2.5 text-charcoal-900 shadow-sm focus:border-charcoal-900 focus:outline-none focus:ring-2 focus:ring-sun-400 aria-[invalid=true]:border-red-600 disabled:bg-charcoal-50";

type Props = { label: string; name: string; error?: string; hint?: string; children: ReactNode };

/** Label + control + hint/error, wired for screen readers via `${name}-error` / `${name}-hint` ids. */
export function Field({ label, name, error, hint, children }: Props) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-charcoal-900">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(name: string, error?: string, hint?: string) {
  return error ? `${name}-error` : hint ? `${name}-hint` : undefined;
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-800",
    success: "bg-green-50 text-green-800",
    info: "bg-sun-50 text-charcoal-900",
  };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </p>
  );
}
