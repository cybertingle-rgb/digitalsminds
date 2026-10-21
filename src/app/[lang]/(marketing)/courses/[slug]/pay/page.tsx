import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FormAlert } from "@/components/forms/Field";
import { PayForm } from "@/components/payments/PayForm";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/modules/auth/session";
import { courseBySlug, listingText } from "@/modules/learning/catalogue";
import { enrollmentFor } from "@/modules/learning/enrollment";
import { availableMethods, coursePrice, formatPkr, getPaymentDetails } from "@/modules/payments/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

export default async function PayPage({ params }: PageProps<"/[lang]/courses/[slug]/pay">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const here = localizePath(`/courses/${slug}/pay`, lang);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", lang)}?next=${encodeURIComponent(here)}`);
  const course = await courseBySlug(slug).catch(() => null);
  const price = course && course.status === "PUBLISHED" ? coursePrice(course) : null;
  if (!course || !price) notFound();
  const enrollment = await enrollmentFor(user.id, course.id);
  if (enrollment?.status === "APPROVED") redirect(localizePath(`/learn/${course.slug}`, lang));

  const dict = getDictionary(lang);
  const t = dict.payments;
  const amount = formatPkr(price);
  const title = listingText(course, lang).title;
  const [details, pending] = await Promise.all([getPaymentDetails(), db().payment.findFirst({ where: { userId: user.id, courseId: course.id, status: "PENDING" } })]);
  const methods = availableMethods(details);
  const instructions = lang === "ur" ? details.instructionsUr || details.instructions : details.instructions;
  const row = (label: string, value?: string) =>
    value ? (
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-1.5">
        <dt className="text-muted">{label}</dt>
        <dd className="font-semibold text-charcoal-900" dir="ltr">{value}</dd>
      </div>
    ) : null;

  return (
    <Section>
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{t.paidCourse}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-charcoal-900 sm:text-4xl" dir="auto">{format(t.payTitle, { course: title })}</h1>
          <p className="mt-3 max-w-3xl text-muted">{format(t.payIntro, { amount })}</p>
        </div>

        {pending ? (
          <FormAlert tone="info">{t.pending}</FormAlert>
        ) : methods.length === 0 ? (
          <div className="glass space-y-4 rounded-2xl p-6">
            <p className="text-charcoal-800">{t.notSetUp}</p>
            <LinkButton href={`${localizePath("/contact", lang)}?service=ebay-course`}>{t.contactUs}</LinkButton>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-5">
            <section aria-labelledby="how-to-pay" className="glass space-y-5 rounded-2xl p-6 lg:col-span-2">
              <h2 id="how-to-pay" className="text-lg font-bold text-charcoal-900">{t.howToPay}</h2>
              <p className="glass-subtle rounded-xl px-4 py-3 text-charcoal-900">
                {t.amountToSend}: <strong dir="ltr">{amount}</strong>
              </p>
              {methods.includes("BANK_TRANSFER") && (
                <div>
                  <h3 className="font-semibold text-charcoal-900">{t.bank}</h3>
                  <dl className="mt-1 divide-y divide-charcoal-200/60 text-sm">
                    {row(t.bankName, details.bankName)}
                    {row(t.accountTitle, details.bankAccountTitle)}
                    {row(t.accountNumber, details.bankAccountNumber)}
                  </dl>
                </div>
              )}
              {methods.includes("JAZZCASH") && (
                <div>
                  <h3 className="font-semibold text-charcoal-900">{t.jazzcash}</h3>
                  <dl className="mt-1 divide-y divide-charcoal-200/60 text-sm">
                    {row(t.accountTitle, details.jazzcashTitle)}
                    {row(t.walletNumber, details.jazzcashNumber)}
                  </dl>
                </div>
              )}
              {methods.includes("EASYPAISA") && (
                <div>
                  <h3 className="font-semibold text-charcoal-900">{t.easypaisa}</h3>
                  <dl className="mt-1 divide-y divide-charcoal-200/60 text-sm">
                    {row(t.accountTitle, details.easypaisaTitle)}
                    {row(t.walletNumber, details.easypaisaNumber)}
                  </dl>
                </div>
              )}
              {instructions && <p className="whitespace-pre-line text-sm text-charcoal-700" dir="auto">{instructions}</p>}
            </section>
            <section aria-labelledby="pay-form" className="glass-strong rounded-2xl !border-t-4 !border-t-sun-400 p-6 lg:col-span-3">
              <h2 id="pay-form" className="mb-4 text-lg font-bold text-charcoal-900">{t.formTitle}</h2>
              {enrollment?.status === "REJECTED" && enrollment.decisionNote && (
                <div className="mb-4">
                  <FormAlert tone="error">{`${t.rejectedTitle} ${enrollment.decisionNote}`}</FormAlert>
                </div>
              )}
              <PayForm
                courseId={course.id}
                methods={methods.map((m) => ({ value: m, label: { BANK_TRANSFER: t.bank, JAZZCASH: t.jazzcash, EASYPAISA: t.easypaisa }[m] }))}
                googleEmail={user.googleEmail ?? user.email}
                doneHref={localizePath("/account", lang)}
                labels={t}
              />
            </section>
          </div>
        )}
      </div>
    </Section>
  );
}
