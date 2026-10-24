"use client";

import { useEffect, useId } from "react";
import { BASE_CURRENCY, SUPPORTED_CURRENCIES } from "@/modules/currency/rules";
import { useCurrency } from "./CurrencyContext";

/** "Show prices in" picker; only currencies with a fresh rate are offered. Hidden when there are none. */
export function CurrencySwitcher({ className = "", attribution = true }: { className?: string; attribution?: boolean }) {
  const { currency, rates, labels, setCurrency, want } = useCurrency();
  const id = useId();
  useEffect(want, [want]);
  if (!rates || rates.enabled.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <label htmlFor={id} className="text-charcoal-700">{labels.showIn}</label>
      <select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-charcoal-200 bg-white/80 px-2 py-1 text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-sun-400">
        <option value={BASE_CURRENCY}>{labels.pkrOption}</option>
        {rates.enabled.map((c) => (
          <option key={c} value={c}>{c} · {SUPPORTED_CURRENCIES[c as keyof typeof SUPPORTED_CURRENCIES] ?? c}</option>
        ))}
      </select>
      {attribution && rates.attribution && currency !== BASE_CURRENCY && (
        <a href={rates.attribution.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline-offset-4 hover:underline">{rates.attribution.text}</a>
      )}
    </div>
  );
}
