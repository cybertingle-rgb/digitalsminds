/**
 * Currency conversion for price display. PKR is the base currency: every fee
 * is stored in paisa, and other currencies are display estimates converted
 * with the last known good rate. Pure functions, shared by server and browser.
 */

export const BASE_CURRENCY = "PKR";

/** Currencies the site can show (ISO 4217). Admins choose which are offered. */
export const SUPPORTED_CURRENCIES = {
  PKR: "Pakistani rupee",
  USD: "US dollar",
  GBP: "British pound",
  EUR: "Euro",
  AED: "UAE dirham",
  SAR: "Saudi riyal",
  QAR: "Qatari riyal",
  KWD: "Kuwaiti dinar",
  OMR: "Omani rial",
  BHD: "Bahraini dinar",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
  NZD: "New Zealand dollar",
  INR: "Indian rupee",
  BDT: "Bangladeshi taka",
  MYR: "Malaysian ringgit",
  SGD: "Singapore dollar",
  TRY: "Turkish lira",
  CNY: "Chinese yuan",
  JPY: "Japanese yen",
  ZAR: "South African rand",
  CHF: "Swiss franc",
  SEK: "Swedish krona",
  NOK: "Norwegian krone",
  DKK: "Danish krone",
} as const;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export const DEFAULT_ENABLED: CurrencyCode[] = ["USD", "GBP", "EUR", "AED", "SAR", "QAR", "KWD", "OMR", "BHD", "CAD", "AUD"];

export function isSupportedCurrency(code: unknown): code is CurrencyCode {
  return typeof code === "string" && Object.hasOwn(SUPPORTED_CURRENCIES, code);
}

/** ISO minor-unit digits (JPY 0, KWD/OMR/BHD 3, most 2). */
export function minorDigits(code: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * PKR paisa -> minor units of `code`, rounded half away from zero to the
 * currency's minor unit. `perPkr` = units of `code` per 1 PKR.
 */
export function convertFromPkr(pkrPaisa: number, perPkr: number, code: string): number {
  if (!Number.isFinite(pkrPaisa) || !Number.isFinite(perPkr) || perPkr <= 0) throw new RangeError("Invalid amount or rate");
  const digits = minorDigits(code);
  const major = (pkrPaisa / 100) * perPkr;
  const scaled = major * 10 ** digits;
  // Nudge by a tiny epsilon so values like 2.675 round the way people expect.
  return Math.sign(scaled) * Math.round(Math.abs(scaled) + 1e-9);
}

/** Minor units -> "$53.72", "¥8,100", "£1,180" (whole units from 1,000 up, where cents add nothing). */
export function formatMoney(minor: number, code: string, locale = "en"): string {
  const digits = minorDigits(code);
  const major = minor / 10 ** digits;
  const whole = Math.abs(major) >= 1000 || (code === "PKR" && Number.isInteger(major));
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: code === "PKR" ? "code" : "narrowSymbol",
    minimumFractionDigits: whole ? 0 : digits,
    maximumFractionDigits: whole ? 0 : digits,
  })
    .format(major)
    .replace(/^PKR\s?/, "Rs ");
}

/** A rate older than this is not used for display (the price is shown in PKR instead). */
export const DEFAULT_MAX_AGE_HOURS = 72;

export function isFresh(sourceUpdatedAt: Date | string, maxAgeHours: number, now = Date.now()) {
  const t = new Date(sourceUpdatedAt).getTime();
  return Number.isFinite(t) && now - t <= maxAgeHours * 3600_000 && t <= now + 3600_000;
}

export type DisplayRates = {
  provider: string;
  /** code -> { perPkr, updatedAt (ISO) }, only fresh rates for enabled currencies. */
  rates: Record<string, { perPkr: number; updatedAt: string }>;
  enabled: string[];
};

// ---------------------------------------------------------------------------
// Guessing a visitor's currency (country level only; the visitor can change it)
// ---------------------------------------------------------------------------

const EURO = ["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"];

/** ISO country -> currency, for countries whose currency the site supports. */
export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  PK: "PKR",
  US: "USD",
  PR: "USD",
  GB: "GBP",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  OM: "OMR",
  BH: "BHD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  IN: "INR",
  BD: "BDT",
  MY: "MYR",
  SG: "SGD",
  TR: "TRY",
  CN: "CNY",
  JP: "JPY",
  ZA: "ZAR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  ...Object.fromEntries(EURO.map((c) => [c, "EUR" as const])),
};

/** IANA time zone -> country (main zones only), used when no country signal is available. */
const ZONE_COUNTRY: Record<string, string> = {
  "Asia/Karachi": "PK",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Asia/Bahrain": "BH",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Dhaka": "BD",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Singapore": "SG",
  "Asia/Shanghai": "CN",
  "Asia/Tokyo": "JP",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Istanbul": "TR",
  "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Vienna": "AT",
  "Europe/Lisbon": "PT",
  "Europe/Athens": "GR",
  "Europe/Helsinki": "FI",
  "Africa/Johannesburg": "ZA",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Pacific/Auckland": "NZ",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
};

export function countryFromTimeZone(tz: string | undefined | null): string | null {
  return (tz && ZONE_COUNTRY[tz]) || null;
}

/**
 * The currency to show a visitor: their own choice, else their country's
 * currency if it's offered and has a fresh rate, else PKR.
 */
export function chooseCurrency(opts: { chosen?: string | null; country?: string | null; available: string[] }): string {
  const ok = (c: string | null | undefined): c is string => !!c && (c === BASE_CURRENCY || opts.available.includes(c));
  if (ok(opts.chosen)) return opts.chosen;
  const fromCountry = opts.country ? COUNTRY_CURRENCY[opts.country.toUpperCase()] : undefined;
  return ok(fromCountry) ? fromCountry : BASE_CURRENCY;
}
