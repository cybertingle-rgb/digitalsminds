import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { requirePagePermission } from "@/modules/auth/session";
import { formatMoney, isFresh, isSupportedCurrency, SUPPORTED_CURRENCIES } from "@/modules/currency/rules";
import { getCurrencySettings, getRefreshStatus, pricesToReview, PROVIDERS, storedRates } from "@/modules/currency/service";
import { ConvertPriceButton, CurrencySettingsForm, RefreshButton } from "./CurrencyForms";

export const metadata: Metadata = { title: "Currency & rates" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function CurrencyPage() {
  await requirePagePermission("payments.manage", "/admin/payments/currency");
  const [settings, status, rates, review] = await Promise.all([getCurrencySettings(), getRefreshStatus(), storedRates(), pricesToReview()]);
  const shown = rates.filter((r) => settings.enabled.includes(r.currency));
  const freshCount = shown.filter((r) => r.provider === settings.provider && isFresh(r.sourceUpdatedAt, settings.maxAgeHours)).length;
  const failing = !!status.lastError;

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-charcoal-900">← Payments</Link>
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Currency &amp; rates</h1>
        <p className="mt-1 text-muted">
          Fees are set and charged in PKR. Visitors abroad also see an estimate in their own currency, converted with the latest rate. The estimate is for
          information only: applicants still pay the PKR fee to the accounts in Payment details, and a rate that is too old is never shown.
        </p>
      </div>

      <section aria-labelledby="status" className={`glass rounded-2xl p-6 ${failing ? "!border-s-4 !border-s-red-500" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="status" className="text-lg font-semibold text-charcoal-900">Status</h2>
          <StatusBadge tone={freshCount > 0 && !failing ? "ok" : freshCount > 0 ? "warn" : "off"}>
            {freshCount > 0 ? `${freshCount} of ${settings.enabled.length} currencies shown` : "Prices shown in PKR only"}
          </StatusBadge>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Source</dt><dd className="text-charcoal-900">{PROVIDERS[settings.provider].label}</dd></div>
          <div><dt className="text-muted">Last successful update</dt><dd className="text-charcoal-900">{status.lastSuccessAt ? dateFmt.format(new Date(status.lastSuccessAt)) : "Never"}</dd></div>
          <div><dt className="text-muted">Last attempt</dt><dd className="text-charcoal-900">{status.lastAttemptAt ? dateFmt.format(new Date(status.lastAttemptAt)) : "Never"}</dd></div>
          <div><dt className="text-muted">Schedule</dt><dd className="text-charcoal-900">Every {settings.refreshHours} h · rates older than {settings.maxAgeHours} h are not shown</dd></div>
        </dl>
        {failing && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">Last update failed: {status.lastError} The last good rates stay in use until they are {settings.maxAgeHours} hours old.</p>}
        <div className="mt-4"><RefreshButton /></div>
      </section>

      <section aria-labelledby="rates" className="glass rounded-2xl p-6">
        <h2 id="rates" className="text-lg font-semibold text-charcoal-900">Current rates</h2>
        {shown.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No rates yet. Press “Update rates now”.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr><th className="py-2 pe-3">Currency</th><th className="py-2 pe-3">1 unit =</th><th className="py-2 pe-3">Rs 10,000 ≈</th><th className="py-2 pe-3">Rate date</th><th className="py-2">Shown</th></tr>
              </thead>
              <tbody className="divide-y divide-charcoal-200/50">
                {shown.map((r) => {
                  const per = Number(r.perPkr);
                  const fresh = r.provider === settings.provider && isFresh(r.sourceUpdatedAt, settings.maxAgeHours);
                  return (
                    <tr key={r.currency}>
                      <td className="py-2 pe-3"><span className="font-mono">{r.currency}</span> <span className="text-muted">{isSupportedCurrency(r.currency) ? SUPPORTED_CURRENCIES[r.currency] : ""}</span></td>
                      <td className="py-2 pe-3" dir="ltr">Rs {(1 / per).toLocaleString("en", { maximumFractionDigits: 2 })}</td>
                      <td className="py-2 pe-3" dir="ltr">{formatMoney(Math.round(10_000 * per * 100), r.currency)}</td>
                      <td className="py-2 pe-3">{dateFmt.format(r.sourceUpdatedAt)}</td>
                      <td className="py-2"><StatusBadge tone={fresh ? "ok" : "off"}>{fresh ? "Yes" : "Too old"}</StatusBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {review.length > 0 && (
        <section aria-labelledby="review" className="glass rounded-2xl !border-s-4 !border-s-sun-400 p-6">
          <h2 id="review" className="text-lg font-semibold text-charcoal-900">Prices to review ({review.length})</h2>
          <p className="mt-1 text-sm text-muted">
            These fees were entered in a currency other than PKR (or without one). Convert them with the current rate (the original amount, rate and date are kept),
            or set the PKR fee yourself on the program page.
          </p>
          <ul className="mt-4 space-y-3">
            {review.map((c) => {
              const known = !!c.originalCurrency && isSupportedCurrency(c.originalCurrency);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/60 p-4">
                  <div className="min-w-0">
                    <Link href={`/admin/courses/${c.id}`} className="font-semibold text-charcoal-900 hover:underline">{c.title}</Link>
                    <p className="text-sm text-muted">
                      Stored price: {c.originalPriceAmount ?? "—"} (minor units) in {c.originalCurrency ?? "an unknown currency"}
                      {known && c.originalPriceAmount !== null && ` = ${formatMoney(c.originalPriceAmount, c.originalCurrency!)}`}
                    </p>
                  </div>
                  {known ? <ConvertPriceButton id={c.id} /> : <Link href={`/admin/courses/${c.id}`} className="text-sm font-semibold underline">Set the PKR fee</Link>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="settings" className="glass rounded-2xl p-6">
        <h2 id="settings" className="mb-4 text-lg font-semibold text-charcoal-900">Settings</h2>
        <CurrencySettingsForm
          providers={Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, needsKey: p.needsKey }))}
          currencies={Object.entries(SUPPORTED_CURRENCIES).filter(([c]) => c !== "PKR").map(([code, name]) => ({ code, name }))}
          value={{ provider: settings.provider, hasKey: !!settings.apiKeyEnc, enabled: settings.enabled, maxAgeHours: settings.maxAgeHours, refreshHours: settings.refreshHours, manual: settings.manual }}
        />
      </section>
    </div>
  );
}
