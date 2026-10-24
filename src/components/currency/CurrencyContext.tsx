"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { BASE_CURRENCY, chooseCurrency, countryFromTimeZone, type DisplayRates } from "@/modules/currency/rules";

type Rates = DisplayRates & { attribution: { text: string; url: string } | null };
type Ctx = {
  currency: string;
  rates: Rates | null;
  labels: Dictionary["currency"];
  locale: string;
  setCurrency: (code: string) => void;
  /** Price components call this so rates are only fetched on pages that show a price. */
  want: () => void;
};

const CurrencyCtx = createContext<Ctx | null>(null);
const CHOSEN = "dm_currency";
const COUNTRY = "dm_country";

function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** Visitor's country: a CDN-provided header if there is one, else the browser's time zone. Never GPS. */
async function detectCountry(): Promise<string | null> {
  const cached = stored(COUNTRY);
  if (cached) return cached === "-" ? null : cached;
  let country: string | null = null;
  try {
    const r = await fetch("/api/geo", { cache: "no-store" });
    if (r.ok) country = ((await r.json()) as { country: string | null }).country;
  } catch {}
  country ??= countryFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  store(COUNTRY, country ?? "-");
  return country;
}

export function CurrencyProvider({ labels, locale, children }: { labels: Dictionary["currency"]; locale: string; children: ReactNode }) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [currency, setCurrencyState] = useState(BASE_CURRENCY);
  const wanted = useRef(false);
  const [needed, setNeeded] = useState(false);

  const want = useCallback(() => {
    if (!wanted.current) {
      wanted.current = true;
      setNeeded(true);
    }
  }, []);

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/currency");
        if (!r.ok) return;
        const data = (await r.json()) as Rates;
        const chosen = stored(CHOSEN);
        const country = chosen ? null : await detectCountry();
        if (cancelled) return;
        setRates(data);
        setCurrencyState(chooseCurrency({ chosen, country, available: data.enabled }));
      } catch {
        // No rates: prices stay in PKR.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needed]);

  const setCurrency = useCallback((code: string) => {
    store(CHOSEN, code);
    setCurrencyState(code);
  }, []);

  const value = useMemo(() => ({ currency, rates, labels, locale, setCurrency, want }), [currency, rates, labels, locale, setCurrency, want]);
  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) throw new Error("useCurrency outside CurrencyProvider");
  return ctx;
}
