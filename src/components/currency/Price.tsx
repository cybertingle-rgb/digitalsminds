"use client";

import { useEffect, useId } from "react";
import { format } from "@/i18n/merge";
import { BASE_CURRENCY, convertFromPkr, formatMoney, SUPPORTED_CURRENCIES } from "@/modules/currency/rules";
import { useCurrency } from "./CurrencyContext";

/**
 * A PKR fee, with a converted estimate in the visitor's currency when one is
 * chosen and a fresh rate exists. Renders plain PKR on the server and until
 * rates arrive, so a missing rate never shows a wrong number.
 */
export function Price({ pkr, size = "inline", className = "" }: { pkr: number; size?: "inline" | "large"; className?: string }) {
  const { currency, rates, labels, locale, want } = useCurrency();
  const noteId = useId();
  useEffect(want, [want]);
  const pkrText = formatMoney(pkr, BASE_CURRENCY);
  const rate = currency !== BASE_CURRENCY ? rates?.rates[currency] : undefined;

  if (!rate) {
    return (
      <span className={className} dir="ltr">
        {pkrText}
      </span>
    );
  }
  const estimate = formatMoney(convertFromPkr(pkr, rate.perPkr, currency), currency, locale === "ur" ? "en" : locale);
  const note = format(labels.estimateNote, {
    currency: SUPPORTED_CURRENCIES[currency as keyof typeof SUPPORTED_CURRENCIES] ?? currency,
    pkr: pkrText,
    date: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(rate.updatedAt)),
  });
  if (size === "large") {
    return (
      <span className={`block ${className}`}>
        <span className="block" dir="ltr">
          <span className="sr-only">{labels.estimateTitle}: </span>≈ {estimate}
        </span>
        <span className="mt-1 block text-base font-semibold text-charcoal-700" dir="ltr">{pkrText}</span>
        <span id={noteId} className="mt-2 block text-xs font-normal text-muted">{note}</span>
      </span>
    );
  }
  return (
    <span className={className} title={note} dir="ltr">
      ≈ {estimate} <span className="text-muted">({pkrText})</span>
    </span>
  );
}
