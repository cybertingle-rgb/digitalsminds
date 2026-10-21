import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { FormAlert } from "@/components/forms/Field";
import { LiveClassCard } from "@/components/learning/LiveClassCard";
import { batchLine, stageHelp } from "@/components/portal/PortalParts";
import { LinkButton } from "@/components/ui/Button";
import { localeMeta, localizePath } from "@/i18n/config";
import { format } from "@/i18n/merge";
import { authPage, noindex } from "@/modules/auth/pages";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { listingText } from "@/modules/learning/catalogue";
import { profileOf } from "@/modules/learning/profile";
import { studentLiveClasses } from "@/modules/live/service";
import { ACTIVE_STAGES, advanceStages, myEnrollments, myNotices, onboardingFor } from "@/modules/portal/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Student portal", robots: noindex };

export default async function DashboardPage({ params, searchParams }: PageProps<"/[lang]/account">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  const here = localizePath("/account", locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const t = dict.account;
  const p = dict.portal;
  const sp = await searchParams;
  // Opening the portal starts onboarding; finished checklists make the student active.
  await advanceStages(user.id);
  const [enrollments, notices, live, profile] = await Promise.all([myEnrollments(user.id), myNotices(user.id, 3), studentLiveClasses(user.id), profileOf(user.id)]);
  const current = enrollments.filter((e) => (ACTIVE_STAGES as readonly string[]).includes(e.effective) || e.effective === "COMPLETED");
  const onboarding = await Promise.all(current.filter((e) => e.effective !== "COMPLETED").map(async (e) => ({ e, o: await onboardingFor(e) })));
  const nextLive = live.upcoming.find((c) => c.status === "SCHEDULED");
  const incomplete = !profile?.phone || !profile?.city;
  const dateFmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-8">
      {sp.verified && <FormAlert tone="success">{dict.auth.verifiedNotice}</FormAlert>}
      {incomplete && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sun-400 bg-sun-50 p-4 text-sm text-charcoal-900">
          <p>{t.completeProfile}</p>
          <Link href={localizePath("/account/profile", locale)} className="font-semibold underline underline-offset-4">{t.completeProfileLink}</Link>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{t.navDashboard}</p>
          <h1 className="mt-2 text-3xl font-bold text-charcoal-900" dir="auto">{format(t.welcome, { name: user.name })}</h1>
          <p className="mt-1 text-muted">{p.dashboardIntro}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:hidden">
          {can(user.role, "admin.access") && <LinkButton href="/admin" variant="secondary">{t.adminLink}</LinkButton>}
          <LogoutButton label={dict.auth.logout} redirectTo={localizePath("/", locale)} />
        </div>
      </div>

      {current.length === 0 ? (
        <section className="glass-subtle space-y-3 rounded-3xl p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-charcoal-900">{p.noEnrollmentTitle}</h2>
          <p className="text-charcoal-800">{p.noEnrollmentText}</p>
          <LinkButton href={localizePath("/courses", locale)}>{p.browsePrograms}</LinkButton>
        </section>
      ) : (
        <ul className="space-y-4">
          {current.map((e) => {
            const o = onboarding.find((x) => x.e.id === e.id)?.o;
            return (
              <li key={e.id} className="glass-blur border-run-live relative overflow-hidden rounded-3xl p-6 sm:p-8" aria-label={e.course.title}>
                <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{p.stageTitle}</p>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold text-charcoal-900" dir="auto">{e.course.title}</h2>
                    {batchLine(e, dict) && <p className="mt-1 text-sm text-charcoal-700">{batchLine(e, dict)}</p>}
                    {e.batch && <p className="text-sm text-muted">{e.batch.scheduleText}</p>}
                    <p className="mt-3 inline-flex rounded-full bg-charcoal-900 px-3 py-1 text-sm font-semibold text-sun-400">{dict.apply.stages[e.effective]}</p>
                    <p className="mt-2 text-sm text-charcoal-800">{stageHelp(e, dict)}</p>
                    {o && o.requiredTotal > 0 && e.effective !== "ACTIVE" && (
                      <p className="mt-2 text-sm font-medium text-charcoal-900">{format(p.onboardingProgress, { done: String(o.requiredDone), total: String(o.requiredTotal) })}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.effective === "ONBOARDING" && o && o.requiredTotal > 0 ? (
                      <LinkButton href={localizePath("/account/onboarding", locale)} className="border-run">{p.navOnboarding}</LinkButton>
                    ) : (
                      <LinkButton href={localizePath("/account/program", locale)} variant="secondary">{p.navProgram}</LinkButton>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextLive && (
        <section aria-labelledby="next-live" className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="next-live" className="text-sm font-semibold uppercase tracking-wider text-gold-700">{dict.live.nextClass}</h2>
            <Link href={localizePath("/account/schedule", locale)} className="text-sm font-semibold text-charcoal-900 underline underline-offset-4">{dict.live.allClasses}</Link>
          </div>
          <LiveClassCard c={nextLive} locale={locale} dict={dict} compact />
        </section>
      )}

      {notices.length > 0 && (
        <section aria-labelledby="news">
          <div className="flex items-center justify-between gap-3">
            <h2 id="news" className="text-xl font-bold text-charcoal-900">{p.latestNotices}</h2>
            <Link href={localizePath("/account/notices", locale)} className="text-sm font-semibold text-charcoal-900 underline underline-offset-4">{p.allNotices}</Link>
          </div>
          <ul className="mt-4 space-y-3">
            {notices.map((a) => (
              <li key={a.id} className="glass rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700" dir="auto">
                  {a.batch?.name ?? (a.course ? listingText({ title: a.course.title, titleUr: a.course.titleUr, summary: "", summaryUr: null }, locale).title : p.forEveryone)}
                  {a.publishedAt && <span className="ms-2 font-normal normal-case tracking-normal text-muted">{dateFmt.format(a.publishedAt)}</span>}
                </p>
                <h3 className="mt-1 font-semibold text-charcoal-900" dir="auto">{a.title}</h3>
                <RichText text={a.body} className="mt-2 text-sm text-charcoal-800" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="quick" className="glass-subtle rounded-3xl p-6">
        <h2 id="quick" className="text-sm font-semibold uppercase tracking-wider text-gold-700">{p.quickLinks}</h2>
        <ul className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          {[
            [p.navSchedule, "/account/schedule"],
            [p.navDocuments, "/account/documents"],
            [p.supportLink, "/account/support"],
            [t.navProfile, "/account/profile"],
          ].map(([label, href]) => (
            <li key={href}><Link href={localizePath(href!, locale)} className="inline-block rounded-xl bg-white/70 px-4 py-2 text-charcoal-900 hover:bg-white">{label}</Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
