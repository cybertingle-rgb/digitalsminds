import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { FormAlert } from "@/components/forms/Field";
import { ProgressBar, RequestsList } from "@/components/learning/AccountSections";
import { LinkButton } from "@/components/ui/Button";
import { localeMeta, localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { studentAnnouncements } from "@/modules/announcements/service";
import { authPage, noindex } from "@/modules/auth/pages";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { listingText } from "@/modules/learning/catalogue";
import { studentDashboard, type Activity } from "@/modules/learning/dashboard";
import { latestPaymentsFor } from "@/modules/payments/service";
import { studentLiveClasses } from "@/modules/live/service";
import { LiveClassCard } from "@/components/learning/LiveClassCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My learning", robots: noindex };

function learningTime(minutes: number, t: Dictionary["account"]) {
  const h = Math.floor(minutes / 60);
  return h ? format(t.hoursMinutes, { hours: String(h), minutes: String(minutes % 60) }) : format(t.minutesOnly, { minutes: String(minutes) });
}

function Stat({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <li className={`${accent ? "glass-sun" : "glass"} rounded-2xl p-4 sm:p-5`}>
      <p className="text-2xl font-bold text-charcoal-900 sm:text-3xl" dir="ltr">{value}</p>
      <p className="mt-1 text-sm text-charcoal-700">{label}</p>
    </li>
  );
}

function ActivityItem({ a, locale, dict, fmt }: { a: Activity; locale: Locale; dict: Dictionary; fmt: Intl.DateTimeFormat }) {
  const t = dict.account;
  const course = listingText({ title: a.course.title, titleUr: a.course.titleUr, summary: "", summaryUr: null }, locale).title;
  const text =
    a.kind === "lesson" ? format(t.activityLesson, { lesson: a.lesson, course }) : a.kind === "certificate" ? format(t.activityCertificate, { course }) : format(t.activityEnrolled, { course });
  const href = a.kind === "certificate" ? `/certificates/${a.code}` : a.kind === "lesson" ? `/learn/${a.slug}` : `/courses/${a.slug}`;
  const dot = a.kind === "certificate" ? "bg-sun-500" : a.kind === "lesson" ? "bg-charcoal-900" : "bg-charcoal-300";
  return (
    <li className="flex gap-3 py-3">
      <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <Link href={localizePath(href, locale)} className="text-sm text-charcoal-900 hover:underline" dir="auto">{text}</Link>
        <p className="text-xs text-muted">{fmt.format(a.at)}</p>
      </div>
    </li>
  );
}

export default async function DashboardPage({ params, searchParams }: PageProps<"/[lang]/account">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  const here = localizePath("/account", locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const t = dict.account;
  const sp = await searchParams;
  const [{ learning, enrolled, stats, continueWith, activity }, news, live] = await Promise.all([studentDashboard(user.id), studentAnnouncements(user.id), studentLiveClasses(user.id)]);
  const nextLive = live.upcoming.find((c) => c.status === "SCHEDULED");
  const requests = learning.filter((l) => l.enrollment.status !== "APPROVED");
  const payments = requests.length ? await latestPaymentsFor(user.id) : new Map();
  const dateFmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });

  return (
    <div className="space-y-8">
      {sp.verified && <FormAlert tone="success">{dict.auth.verifiedNotice}</FormAlert>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{t.navDashboard}</p>
          <h1 className="mt-2 text-3xl font-bold text-charcoal-900" dir="auto">{format(t.welcome, { name: user.name })}</h1>
          <p className="mt-1 text-muted">{t.dashboardIntro}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:hidden">
          {can(user.role, "admin.access") && <LinkButton href="/admin" variant="secondary">{t.adminLink}</LinkButton>}
          <LogoutButton label={dict.auth.logout} redirectTo={localizePath("/", locale)} />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label={t.statInProgress} value={stats.inProgress} accent />
        <Stat label={t.statLessons} value={stats.lessonsDone} />
        {stats.minutes > 0 ? <Stat label={t.statTime} value={learningTime(stats.minutes, t)} /> : <Stat label={t.statCompleted} value={stats.completedCourses} />}
        <Stat label={t.statCertificates} value={stats.certificates} />
      </ul>

      {continueWith ? (
        <section aria-labelledby="continue" className="glass-blur border-run-live relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <p id="continue" className="text-sm font-semibold uppercase tracking-wider text-gold-700">{t.continueTitle}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-charcoal-900" dir="auto">{listingText(continueWith.course, locale).title}</h2>
              {continueWith.lastLesson && <p className="mt-1 text-sm text-charcoal-700" dir="auto">{format(t.continueLesson, { lesson: continueWith.lastLesson.title })}</p>}
              <div className="mt-4 max-w-md">
                <ProgressBar percent={continueWith.percent} label={listingText(continueWith.course, locale).title} />
                <p className="mt-1 text-xs text-muted">{format(dict.learn.progress, { done: String(continueWith.done), total: String(continueWith.total) })}</p>
              </div>
            </div>
            <LinkButton href={localizePath(`/learn/${continueWith.course.slug}`, locale)} className="border-run">{continueWith.lastLesson ? t.continue : t.start}</LinkButton>
          </div>
        </section>
      ) : enrolled.length === 0 ? (
        <section className="glass-subtle rounded-3xl p-6 sm:p-8">
          <p className="text-lg font-semibold text-charcoal-900">{t.noCourses}</p>
          <LinkButton href={localizePath("/courses", locale)} className="mt-4">{t.browseCourses}</LinkButton>
        </section>
      ) : null}

      {nextLive && (
        <section aria-labelledby="next-live" className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="next-live" className="text-sm font-semibold uppercase tracking-wider text-gold-700">{dict.live.nextClass}</h2>
            <Link href={localizePath("/account/live", locale)} className="text-sm font-semibold text-charcoal-900 underline underline-offset-4">{dict.live.allClasses}</Link>
          </div>
          <LiveClassCard c={nextLive} locale={locale} dict={dict} compact />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        {enrolled.length > 0 && (
          <section aria-labelledby="progress" className="glass rounded-3xl p-6 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="progress" className="text-lg font-bold text-charcoal-900">{t.progressTitle}</h2>
              <Link href={localizePath("/account/courses", locale)} className="text-sm font-semibold text-charcoal-900 underline underline-offset-4">{t.viewAllCourses}</Link>
            </div>
            <ul className="mt-4 space-y-4">
              {enrolled.slice(0, 5).map((l) => {
                const title = listingText(l.course, locale).title;
                return (
                  <li key={l.enrollment.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link href={localizePath(`/courses/${l.course.slug}`, locale)} className="min-w-0 truncate font-semibold text-charcoal-900 hover:underline" dir="auto">{title}</Link>
                      <span className="shrink-0 text-xs text-muted" dir="ltr">{l.percent}%</span>
                    </div>
                    <div className="mt-1.5"><ProgressBar percent={l.percent} label={title} /></div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-labelledby="activity" className={`glass rounded-3xl p-6 ${enrolled.length > 0 ? "lg:col-span-2" : "lg:col-span-5"}`}>
          <h2 id="activity" className="text-lg font-bold text-charcoal-900">{t.activityTitle}</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t.activityEmpty}</p>
          ) : (
            <ul className="mt-2 divide-y divide-charcoal-200/50">
              {activity.map((a, i) => <ActivityItem key={i} a={a} locale={locale} dict={dict} fmt={dateFmt} />)}
            </ul>
          )}
        </section>
      </div>

      <RequestsList requests={requests} payments={payments} locale={locale} dict={dict} />

      {news.length > 0 && (
        <section aria-labelledby="news">
          <h2 id="news" className="text-xl font-bold text-charcoal-900">{t.announcementsTitle}</h2>
          <ul className="mt-4 space-y-3">
            {news.slice(0, 3).map((a) => (
              <li key={a.id} className="glass rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700" dir="auto">
                  {a.course ? listingText({ title: a.course.title, titleUr: a.course.titleUr, summary: "", summaryUr: null }, locale).title : dict.announcements.allStudents}
                  {a.publishedAt && <span className="ms-2 font-normal normal-case tracking-normal text-muted">{dateFmt.format(a.publishedAt)}</span>}
                </p>
                <h3 className="mt-1 font-semibold text-charcoal-900" dir="auto">{a.title}</h3>
                <RichText text={a.body} className="mt-2 text-sm text-charcoal-800" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
