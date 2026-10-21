import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BatchFacts, PortalHeading, StageTimeline, stageHelp } from "@/components/portal/PortalParts";
import { LinkButton } from "@/components/ui/Button";
import { localeMeta, localizePath } from "@/i18n/config";
import { authPage, noindex } from "@/modules/auth/pages";
import { getCurrentUser } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { formatPkr } from "@/modules/payments/format";
import { ACTIVE_STAGES, myEnrollments } from "@/modules/portal/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My program", robots: noindex };

export default async function ProgramPage({ params }: PageProps<"/[lang]/account/program">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(localizePath("/account/program", locale))}`);
  const p = dict.portal;
  const enrollments = await myEnrollments(user.id);
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });
  const paymentLabel = { PENDING: p.paymentPending, CONFIRMED: p.paymentVerified, REJECTED: p.paymentRejected } as const;

  return (
    <div className="space-y-8">
      <PortalHeading title={p.navProgram} intro={p.programIntro} />
      {enrollments.length === 0 ? (
        <section className="glass-subtle space-y-3 rounded-3xl p-6">
          <p className="text-charcoal-800">{p.noEnrollmentText}</p>
          <LinkButton href={localizePath("/courses", locale)}>{p.browsePrograms}</LinkButton>
        </section>
      ) : (
        enrollments.map((e) => {
          const active = (ACTIVE_STAGES as readonly string[]).includes(e.effective);
          const link = active ? e.batch?.meetingUrl : null;
          return (
            <article key={e.id} className="grid gap-6 lg:grid-cols-3" aria-label={e.course.title}>
              <div className="space-y-6 lg:col-span-2">
                <section className="glass rounded-3xl p-6">
                  <h2 className="text-2xl font-bold text-charcoal-900" dir="auto">
                    <Link href={localizePath(`/courses/${e.course.slug}`, locale)} className="hover:underline">{e.course.title}</Link>
                  </h2>
                  <p className="mt-2 inline-flex rounded-full bg-charcoal-900 px-3 py-1 text-sm font-semibold text-sun-400">{dict.apply.stages[e.effective]}</p>
                  <p className="mt-2 text-sm text-charcoal-800">{stageHelp(e, dict)}</p>
                  <div className="mt-5"><BatchFacts e={e} dict={dict} /></div>
                </section>
                {active && (e.batch?.joiningInfo || link) && (
                  <section aria-labelledby={`join-${e.id}`} className="glass-strong rounded-3xl !border-t-4 !border-t-sun-400 p-6">
                    <h3 id={`join-${e.id}`} className="text-lg font-bold text-charcoal-900">{p.joining}</h3>
                    {e.batch?.joiningInfo && <RichText text={e.batch.joiningInfo} className="mt-3 text-sm text-charcoal-800" />}
                    {link && (
                      <p className="mt-4">
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-sun-400 px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-sun-500">{p.openLink}</a>
                      </p>
                    )}
                  </section>
                )}
                {e.application && e.application.payments.length > 0 && (
                  <section aria-labelledby={`pay-${e.id}`} className="glass rounded-3xl p-6">
                    <h3 id={`pay-${e.id}`} className="text-lg font-bold text-charcoal-900">{p.payments}</h3>
                    <ul className="mt-3 divide-y divide-charcoal-200/50 text-sm">
                      {e.application.payments.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                          <span>
                            <span className="font-semibold text-charcoal-900" dir="ltr">{formatPkr(x.amountReceived ?? x.amount)}</span>
                            <span className="text-muted"> · <span className="font-mono" dir="ltr">{x.reference}</span> · {fmt.format(x.createdAt)}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.status === "CONFIRMED" ? "bg-green-100 text-green-900" : "bg-charcoal-100 text-charcoal-800"}`}>{paymentLabel[x.status]}</span>
                            {x.receiptKey && <a href={`/api/payments/${x.id}/receipt`} className="font-semibold underline underline-offset-4">{p.receipt}</a>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
              <aside className="glass rounded-3xl p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-700">{p.timeline}</h3>
                <StageTimeline e={e} dict={dict} locale={locale} />
              </aside>
            </article>
          );
        })
      )}
    </div>
  );
}
