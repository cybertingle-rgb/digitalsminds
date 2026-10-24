import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import {
  BASE_CURRENCY,
  convertFromPkr,
  DEFAULT_ENABLED,
  DEFAULT_MAX_AGE_HOURS,
  isFresh,
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  type DisplayRates,
} from "./rules";

/**
 * Exchange rates for showing PKR fees in a visitor's currency. Rates come
 * from a documented provider, are stored as the last known good values with
 * the provider's own update time, and are refreshed on a schedule inside the
 * server. A rate older than the configured age is never shown; the page falls
 * back to PKR. Conversions are estimates for display only: fees are owed and
 * paid in PKR.
 */

export class CurrencyError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CurrencyError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

export const PROVIDERS = {
  /** https://www.exchangerate-api.com/docs/free — no key, daily updates, attribution required. */
  "er-api": { label: "ExchangeRate-API (open access, no key)", attribution: { text: "Rates by ExchangeRate-API", url: "https://www.exchangerate-api.com" }, needsKey: false },
  /** https://www.exchangerate-api.com/docs/standard-requests — needs an API key from a (free or paid) account. */
  "exchangerate-api": { label: "ExchangeRate-API (with your API key)", attribution: { text: "Rates by ExchangeRate-API", url: "https://www.exchangerate-api.com" }, needsKey: true },
  /** Rates typed in by a Super Admin. */
  manual: { label: "Manual rates (entered here)", attribution: null, needsKey: false },
} as const;
export type ProviderId = keyof typeof PROVIDERS;

const SETTINGS_KEY = "currency.settings";
const STATUS_KEY = "currency.status";

const storedSettings = z.object({
  provider: z.enum(Object.keys(PROVIDERS) as [ProviderId, ...ProviderId[]]).default("er-api"),
  apiKeyEnc: z.string().max(2000).optional(),
  enabled: z.array(z.string()).default(DEFAULT_ENABLED),
  maxAgeHours: z.number().int().min(6).max(24 * 14).default(DEFAULT_MAX_AGE_HOURS),
  refreshHours: z.number().int().min(1).max(48).default(12),
  /** code -> PKR per 1 unit (manual provider). */
  manual: z.record(z.string(), z.number().positive()).default({}),
  manualSavedAt: z.string().optional(),
});
export type CurrencySettings = z.infer<typeof storedSettings>;

const storedStatus = z.object({
  lastAttemptAt: z.string().optional(),
  lastSuccessAt: z.string().optional(),
  lastError: z.string().nullable().optional(),
  provider: z.string().optional(),
  count: z.number().optional(),
});
export type RefreshStatus = z.infer<typeof storedStatus>;

async function readSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  try {
    const row = await db().siteSetting.findUnique({ where: { key } });
    const parsed = schema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export const getCurrencySettings = cache(() => readSetting(SETTINGS_KEY, storedSettings, storedSettings.parse({})));
export const getRefreshStatus = () => readSetting(STATUS_KEY, storedStatus, {});

async function writeSetting(key: string, value: unknown, actorId?: string) {
  const json = JSON.parse(JSON.stringify(value));
  await db().siteSetting.upsert({ where: { key }, create: { key, value: json, updatedById: actorId ?? null }, update: { value: json, ...(actorId && { updatedById: actorId }) } });
}

// ---------------------------------------------------------------------------
// Fetching rates
// ---------------------------------------------------------------------------

const providerResponse = z.object({
  result: z.literal("success"),
  base_code: z.literal("PKR"),
  time_last_update_unix: z.number().int().positive(),
  rates: z.record(z.string(), z.number().positive()).optional(),
  conversion_rates: z.record(z.string(), z.number().positive()).optional(),
});

export type FetchedRates = { provider: string; sourceUpdatedAt: Date; rates: Record<string, number> };

/** Calls the provider (10 s timeout). `fetchImpl` is replaceable for tests. */
export async function fetchProviderRates(settings: CurrencySettings, fetchImpl: typeof fetch = fetch): Promise<FetchedRates> {
  if (settings.provider === "manual") {
    const rates = Object.fromEntries(Object.entries(settings.manual).filter(([c]) => isSupportedCurrency(c)).map(([c, pkrPerUnit]) => [c, 1 / pkrPerUnit]));
    if (!Object.keys(rates).length) throw new CurrencyError("No manual rates have been entered.");
    return { provider: "manual", sourceUpdatedAt: new Date(settings.manualSavedAt ?? Date.now()), rates };
  }
  let url: string;
  if (settings.provider === "exchangerate-api") {
    if (!settings.apiKeyEnc) throw new CurrencyError("Enter the ExchangeRate-API key first.");
    url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(decryptSecret(settings.apiKeyEnc))}/latest/PKR`;
  } else {
    url = "https://open.er-api.com/v6/latest/PKR";
  }
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" }, cache: "no-store" });
  } catch (e) {
    throw new CurrencyError(e instanceof Error && e.name === "TimeoutError" ? "The rate provider did not answer within 10 seconds." : "Could not reach the rate provider.");
  }
  if (!res.ok) throw new CurrencyError(`The rate provider answered with HTTP ${res.status}.`);
  const parsed = providerResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new CurrencyError("The rate provider's answer was not in the expected format.");
  const all = parsed.data.rates ?? parsed.data.conversion_rates ?? {};
  const rates = Object.fromEntries(Object.entries(all).filter(([c]) => isSupportedCurrency(c) && c !== BASE_CURRENCY));
  if (!Object.keys(rates).length) throw new CurrencyError("The rate provider returned no usable rates.");
  return { provider: settings.provider, sourceUpdatedAt: new Date(parsed.data.time_last_update_unix * 1000), rates };
}

/**
 * Fetches and stores fresh rates. On failure the last known good rates stay
 * in place (and stop being shown once they are too old); the error is kept
 * for the admin page. Never throws.
 */
export async function refreshRates(fetchImpl?: typeof fetch): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const settings = await readSetting(SETTINGS_KEY, storedSettings, storedSettings.parse({}));
  const status = await getRefreshStatus();
  const attemptAt = new Date().toISOString();
  try {
    const fetched = await fetchProviderRates(settings, fetchImpl);
    const fetchedAt = new Date();
    await db().$transaction(
      Object.entries(fetched.rates).map(([currency, perPkr]) =>
        db().currencyRate.upsert({
          where: { currency },
          create: { currency, perPkr: perPkr.toPrecision(12), provider: fetched.provider, sourceUpdatedAt: fetched.sourceUpdatedAt, fetchedAt },
          update: { perPkr: perPkr.toPrecision(12), provider: fetched.provider, sourceUpdatedAt: fetched.sourceUpdatedAt, fetchedAt },
        }),
      ),
    );
    const count = Object.keys(fetched.rates).length;
    await writeSetting(STATUS_KEY, { lastAttemptAt: attemptAt, lastSuccessAt: fetchedAt.toISOString(), lastError: null, provider: fetched.provider, count });
    return { ok: true, count };
  } catch (e) {
    const error = e instanceof CurrencyError ? e.message : "Unexpected error while updating rates.";
    if (!(e instanceof CurrencyError)) console.warn("[currency] refresh failed:", e instanceof Error ? e.message : e);
    await writeSetting(STATUS_KEY, { ...status, lastAttemptAt: attemptAt, lastError: error, provider: settings.provider }).catch(() => {});
    return { ok: false, error };
  }
}

/** Called by the scheduler: refresh when the last success is older than the refresh interval (retry failures after 30 min). */
export async function refreshIfDue(now = Date.now()) {
  const [settings, status] = await Promise.all([readSetting(SETTINGS_KEY, storedSettings, storedSettings.parse({})), getRefreshStatus()]);
  const last = status.lastSuccessAt ? new Date(status.lastSuccessAt).getTime() : 0;
  const attempted = status.lastAttemptAt ? new Date(status.lastAttemptAt).getTime() : 0;
  if (now - last < settings.refreshHours * 3600_000) return null;
  if (now - attempted < 30 * 60_000) return null;
  return refreshRates();
}

// ---------------------------------------------------------------------------
// Reading rates
// ---------------------------------------------------------------------------

export async function storedRates() {
  try {
    return await db().currencyRate.findMany({ orderBy: { currency: "asc" } });
  } catch {
    return [];
  }
}

/** Fresh rates for the enabled currencies, for the browser. */
export async function getDisplayRates(now = Date.now()): Promise<DisplayRates> {
  const [settings, rows] = await Promise.all([getCurrencySettings(), storedRates()]);
  const enabled = settings.enabled.filter(isSupportedCurrency).filter((c) => c !== BASE_CURRENCY);
  const rates: DisplayRates["rates"] = {};
  for (const r of rows) {
    if (!enabled.includes(r.currency as never) || r.provider !== settings.provider) continue;
    if (!isFresh(r.sourceUpdatedAt, settings.maxAgeHours, now)) continue;
    rates[r.currency] = { perPkr: Number(r.perPkr), updatedAt: r.sourceUpdatedAt.toISOString() };
  }
  return { provider: settings.provider, rates, enabled: Object.keys(rates) };
}

export type PriceSnapshot = { displayCurrency: string; displayAmount: number; displayRate: string; displayRateAt: Date; displayProvider: string };

/** What an applicant was shown in `currency` for a PKR fee, from the server's own fresh rate (null for PKR or no fresh rate). */
export async function priceSnapshot(pkrPaisa: number, currency: string | null | undefined, now = Date.now()): Promise<PriceSnapshot | null> {
  if (!currency || currency === BASE_CURRENCY || !isSupportedCurrency(currency)) return null;
  const display = await getDisplayRates(now);
  const rate = display.rates[currency];
  if (!rate) return null;
  return {
    displayCurrency: currency,
    displayAmount: convertFromPkr(pkrPaisa, rate.perPkr, currency),
    displayRate: rate.perPkr.toPrecision(12),
    displayRateAt: new Date(rate.updatedAt),
    displayProvider: display.provider,
  };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const settingsInput = z.object({
  provider: z.enum(Object.keys(PROVIDERS) as [ProviderId, ...ProviderId[]]),
  apiKey: z.string().trim().max(200).optional(),
  enabled: z.array(z.string().refine(isSupportedCurrency, "Unknown currency")).max(Object.keys(SUPPORTED_CURRENCIES).length),
  maxAgeHours: z.coerce.number().int("Whole hours").min(6, "At least 6 hours").max(24 * 14, "At most 14 days"),
  refreshHours: z.coerce.number().int("Whole hours").min(1, "At least 1 hour").max(48, "At most 48 hours"),
  /** code -> "PKR per 1 unit" as typed. */
  manual: z.record(z.string(), z.string()),
});

function assertManage(actor: Actor) {
  if (!can(actor.role, "payments.manage")) throw new CurrencyError("Only Super Admins can change currency settings.", 403);
}

export async function saveCurrencySettings(input: z.infer<typeof settingsInput>, actor: Actor) {
  assertManage(actor);
  const current = await readSetting(SETTINGS_KEY, storedSettings, storedSettings.parse({}));
  const manual: Record<string, number> = {};
  for (const [code, raw] of Object.entries(input.manual)) {
    const v = raw.replace(/[,\s]/g, "");
    if (!v) continue;
    const n = Number(v);
    if (!isSupportedCurrency(code) || code === BASE_CURRENCY || !Number.isFinite(n) || n <= 0 || n > 10_000_000) throw new CurrencyError(`Check the manual rate for ${code}.`);
    manual[code] = n;
  }
  if (input.provider === "manual" && !Object.keys(manual).length) throw new CurrencyError("Enter at least one manual rate, or choose a provider.");
  const apiKeyEnc = input.apiKey ? encryptSecret(input.apiKey) : current.apiKeyEnc;
  if (input.provider === "exchangerate-api" && !apiKeyEnc) throw new CurrencyError("Enter your ExchangeRate-API key.");
  const manualChanged = JSON.stringify(manual) !== JSON.stringify(current.manual);
  const next: CurrencySettings = {
    provider: input.provider,
    apiKeyEnc,
    enabled: [...new Set(input.enabled)].filter((c) => c !== BASE_CURRENCY),
    maxAgeHours: input.maxAgeHours,
    refreshHours: input.refreshHours,
    manual,
    manualSavedAt: manualChanged ? new Date().toISOString() : current.manualSavedAt,
  };
  await writeSetting(SETTINGS_KEY, next, actor.id);
  await audit({ actorId: actor.id, action: "currency.settings", entityType: "Setting", entityId: SETTINGS_KEY, metadata: { provider: next.provider, enabled: next.enabled, maxAgeHours: next.maxAgeHours } });
  return next;
}

export async function refreshRatesNow(actor: Actor) {
  assertManage(actor);
  const result = await refreshRates();
  await audit({ actorId: actor.id, action: "currency.refresh", entityType: "Setting", entityId: STATUS_KEY, metadata: result.ok ? { count: result.count } : { error: result.error } });
  return result;
}

// ---------------------------------------------------------------------------
// Prices entered before PKR became the base currency
// ---------------------------------------------------------------------------

export function pricesToReview() {
  return db().course.findMany({
    where: { priceNeedsReview: true },
    select: { id: true, title: true, slug: true, priceAmount: true, currency: true, originalPriceAmount: true, originalCurrency: true },
    orderBy: { title: "asc" },
  });
}

/**
 * Converts a flagged price to PKR with the current fresh rate of its original
 * currency, keeping the original amount, the rate, the date and the source.
 * Prices with an unknown currency can't be converted: set the PKR fee by hand.
 */
export async function convertFlaggedPrice(courseId: string, actor: Actor) {
  assertManage(actor);
  const course = await db().course.findUnique({ where: { id: courseId } });
  if (!course?.priceNeedsReview || course.originalPriceAmount == null) throw new CurrencyError("This price doesn't need converting.", 409);
  const from = course.originalCurrency;
  if (!from || !isSupportedCurrency(from)) throw new CurrencyError("The original currency is unknown, so the price can't be converted automatically. Set the PKR fee on the program page.");
  const [settings, rows] = await Promise.all([readSetting(SETTINGS_KEY, storedSettings, storedSettings.parse({})), storedRates()]);
  const rate = rows.find((r) => r.currency === from && r.provider === settings.provider);
  if (!rate || !isFresh(rate.sourceUpdatedAt, settings.maxAgeHours)) throw new CurrencyError(`There is no current ${from} rate. Update the rates first.`, 409);
  const pkrPerUnit = 1 / Number(rate.perPkr);
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: from }).resolvedOptions().maximumFractionDigits ?? 2;
  // Whole rupees, like every other fee.
  const pkrPaisa = Math.round((course.originalPriceAmount / 10 ** digits) * pkrPerUnit) * 100;
  await db().course.update({
    where: { id: courseId },
    data: {
      priceAmount: pkrPaisa,
      currency: BASE_CURRENCY,
      priceConversionRate: pkrPerUnit.toPrecision(10),
      priceConvertedAt: new Date(),
      priceSource: `${PROVIDERS[settings.provider].label}, rate of ${rate.sourceUpdatedAt.toISOString().slice(0, 10)}`,
      priceNeedsReview: false,
    },
  });
  await audit({ actorId: actor.id, action: "course.price_converted", entityType: "Course", entityId: courseId, metadata: { from, original: course.originalPriceAmount, pkrPaisa, pkrPerUnit } });
  return pkrPaisa;
}
