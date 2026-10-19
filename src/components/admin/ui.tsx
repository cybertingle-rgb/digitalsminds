"use client";

import { useState, type ReactNode } from "react";

export function StatusBadge({ tone, children }: { tone: "ok" | "warn" | "off"; children: ReactNode }) {
  const styles = {
    ok: "bg-green-100 text-green-900",
    warn: "bg-sun-100 text-charcoal-900",
    off: "bg-charcoal-100 text-charcoal-700",
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-sm font-medium text-charcoal-900">{label}</p>
      <div className="mt-1 flex gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded-lg border border-line bg-charcoal-50 px-3 py-2 text-sm">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-lg border border-charcoal-200 px-3 py-2 text-sm font-medium hover:bg-charcoal-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "success" | "error" | "info"; children: ReactNode }) {
  const styles = { success: "bg-green-50 text-green-900", error: "bg-red-50 text-red-800", info: "bg-sun-50 text-charcoal-900" };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </p>
  );
}
