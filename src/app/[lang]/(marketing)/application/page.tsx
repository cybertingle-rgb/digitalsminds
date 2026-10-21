import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ApplicationPayForm } from "@/components/admissions/ApplicationPayForm";
import { FindApplicationForm } from "@/components/admissions/FindApplicationForm";
import { FormAlert } from "@/components/forms/Field";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { EnrollmentStage } from "@/generated/prisma/client";
import { hasLocale, localeMeta, localizePath } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { APPLICATION_COOKIE } from "@/modules/admissions/cookie";
import { CLOSED_STAGES, looksLikeToken, STAGE_PATH, stageIndex } from "@/modules/admissions/rules";
import { applicationByToken, type ApplicantView } from "@/modules/admissions/service";
import { formatDay } from "@/modules/batches/rules";
import { availableMethods, formatPkr, getPaymentDetails } from "@/modules/payments/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false } };

/** The applicant's private page, opened through the emailed link (kept in an httpOnly cookie). */
export default async function ApplicationPage({ params, searchParams }: PageProps<"/[lang]/application">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.apply;
  const sp = await searchParams;
  const token = (await cookies()).get(APPLICATION_COOKIE)?.value;
  const app = !sp.invalid && looksLikeToken(token) ? await applicationByToken(token) : null;

  return (
    <Section className="!py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <h1 className="text-3xl font-bold text-charcoal-900">{app ? t.statusTitle : t.findTitle}</h1>
        {app ? <Status app={app} dict={dict} lang={lang} /> : (
          <div className="glass max-w-2xl space-y-4 rounded-3xl p-6 sm:p-8">
            {(sp.invalid || token) && <FormAlert tone="info">{t.linkInvalid}</FormAlert>}
            <p className="text-charcoal-800">{t.findIntro}</p>
            <FindApplicationForm labels={t} errors={dict.auth.errors} />
          </div>
        )}
      </div>
    </Section>
  );
}

async function Status({ app, dict, lang }: { app: ApplicantView; dict: Dictionary; lang: "en" | "ur" }) {
  const t = dict.apply;
  const p = dict.payments;
  const closed = (CLOSED_STAGES as readonly string[]).includes(app.stage);
  const current = stageIndex(app.stage);
  const lastRejection = app.stage === "PAYMENT_PENDING" ? app.payments.find((x) => x.status === "REJECTED") : undefined;
  const reached = new Map<EnrollmentStage, Date>();
  for (const e of app.events) if (!reached.has(e.stage)) reached.set(e.stage, e.createdAt);
  const dateFmt = new Intl.DateTimeFormat(localeMeta[lang].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });
  const path = STAGE_PATH.slice(0, 5);

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <section aria-labelledby="summary" className="glass rounded-3xl p-6">
          <h2 id="summary" className="sr-only">{t.statusTitle}</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">{t.reference}</dt><dd className="font-mono text-base font-semibold text-charcoal-900" dir="ltr">{app.reference}</dd></div>
            <div><dt className="text-muted">{t.program}</dt><dd className="font-semibold text-charcoal-900" dir="auto">{app.course.title}</dd></div>
            <div><dt className="text-muted">{t.batch}</dt><dd className="text-charcoal-900">{app.batch.name}<span className="block text-muted">{format(t.starts, { date: formatDay(app.batch.startDate) })} · {app.batch.scheduleText}</span></dd></div>
            <div><dt className="text-muted">{t.fee}</dt><dd className="text-base font-semibold text-charcoal-900" dir="ltr">{formatPkr(app.feeAmount)}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="stage" className="glass-strong rounded-3xl !border-t-4 !border-t-sun-400 p-6">
          <h2 id="stage" className="text-lg font-bold text-charcoal-900">{t.stages[app.stage]}</h2>
          <p className="mt-1 text-charcoal-800">{t.stageHelp[app.stage]}</p>
          {closed && app.decisionNote && <p className="mt-2 text-sm text-charcoal-800">{format(t.noteFromTeam, { note: app.decisionNote })}</p>}
          {lastRejection?.decisionNote && <div className="mt-3"><FormAlert>{format(t.paymentRejected, { note: lastRejection.decisionNote })}</FormAlert></div>}
          {current >= stageIndex("ENROLLMENT_CONFIRMED") && <LinkButton href={localizePath("/login", lang)} className="mt-4">{t.logIn}</LinkButton>}
        </section>

        {app.stage === "PAYMENT_PENDING" && <PaymentSection dict={dict} amount={app.feeAmount} />}
        {app.payments.length > 0 && (
          <section aria-labelledby="payments" className="glass rounded-3xl p-6">
            <h2 id="payments" className="text-lg font-bold text-charcoal-900">{p.formTitle}</h2>
            <ul className="mt-3 divide-y divide-charcoal-200/50 text-sm">
              {app.payments.map((x) => (
                <li key={x.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span><span className="font-mono" dir="ltr">{x.reference}</span> · {dateFmt.format(x.createdAt)}</span>
                  <span className="font-semibold">{{ PENDING: p.statusPending, CONFIRMED: p.statusConfirmed, REJECTED: p.statusRejected }[x.status]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="lg:col-span-2">
        <ol className="glass space-y-4 rounded-3xl p-6" aria-label={t.statusTitle}>
          {path.map((s, i) => {
            const done = !closed && current >= i;
            const at = reached.get(s);
            return (
              <li key={s} className="flex gap-3" aria-current={app.stage === s ? "step" : undefined}>
                <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-charcoal-900 text-sun-400" : "bg-charcoal-100 text-charcoal-500"}`}>{done ? "✓" : i + 1}</span>
                <span>
                  <span className={`block text-sm ${app.stage === s ? "font-bold text-charcoal-900" : done ? "text-charcoal-900" : "text-muted"}`}>{t.stages[s]}</span>
                  {at && done && <span className="block text-xs text-muted">{dateFmt.format(at)}</span>}
                </span>
              </li>
            );
          })}
          {closed && (
            <li className="flex gap-3" aria-current="step">
              <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">×</span>
              <span className="text-sm font-bold text-charcoal-900">{t.stages[app.stage]}</span>
            </li>
          )}
        </ol>
      </aside>
    </div>
  );
}

async function PaymentSection({ dict, amount }: { dict: Dictionary; amount: number }) {
  const t = dict.payments;
  const details = await getPaymentDetails();
  const methods = availableMethods(details);
  const row = (label: string, value?: string) =>
    value ? (
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-1.5">
        <dt className="text-muted">{label}</dt>
        <dd className="font-semibold text-charcoal-900" dir="ltr">{value}</dd>
      </div>
    ) : null;
  if (methods.length === 0) return <FormAlert tone="info">{t.notSetUp}</FormAlert>;
  return (
    <>
      <section aria-labelledby="how-to-pay" className="glass space-y-5 rounded-3xl p-6">
        <h2 id="how-to-pay" className="text-lg font-bold text-charcoal-900">{t.howToPay}</h2>
        <p className="glass-subtle rounded-xl px-4 py-3 text-charcoal-900">{t.amountToSend}: <strong dir="ltr">{formatPkr(amount)}</strong></p>
        {methods.includes("BANK_TRANSFER") && (
          <div>
            <h3 className="font-semibold text-charcoal-900">{t.bank}</h3>
            <dl className="mt-1 divide-y divide-charcoal-200/60 text-sm">{row(t.bankName, details.bankName)}{row(t.accountTitle, details.bankAccountTitle)}{row(t.accountNumber, details.bankAccountNumber)}</dl>
          </div>
        )}
        {methods.includes("JAZZCASH") && (
          <div>
            <h3 className="font-semibold text-charcoal-900">{t.jazzcash}</h3>
            <dl className="mt-1 divide-y divide-charcoal-200/60 text-sm">{row(t.accountTitle, details.jazzcashTitle)}{row(t.walletNumber, details.jazzcashNumber)}</dl>
          </div>
        )}
        {methods.includes("EASYPAISA") && (
          <div>
            <h3 className="font-semibold text-charcoal-900">{t.easypaisa}</h3>
            <dl className="mt-1 divide-y divide-charcoal-200/60 text-sm">{row(t.accountTitle, details.easypaisaTitle)}{row(t.walletNumber, details.easypaisaNumber)}</dl>
          </div>
        )}
        {details.instructions && <p className="whitespace-pre-line text-sm text-charcoal-700" dir="auto">{details.instructions}</p>}
      </section>
      <section aria-labelledby="pay-form" className="glass rounded-3xl p-6">
        <h2 id="pay-form" className="mb-4 text-lg font-bold text-charcoal-900">{t.formTitle}</h2>
        <ApplicationPayForm methods={methods.map((m) => ({ value: m, label: { BANK_TRANSFER: t.bank, JAZZCASH: t.jazzcash, EASYPAISA: t.easypaisa }[m] }))} labels={t} />
      </section>
    </>
  );
}
