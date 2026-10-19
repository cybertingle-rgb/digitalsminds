import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { FormAlert } from "@/components/forms/Field";
import { ProfileForm } from "@/components/learning/ProfileForm";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { localeMeta, localizePath } from "@/i18n/config";
import { format } from "@/i18n/merge";
import { authPage, noindex } from "@/modules/auth/pages";
import { can } from "@/modules/auth/permissions";
import { getCurrentUser } from "@/modules/auth/session";
import { listingText } from "@/modules/learning/catalogue";
import { profileOf } from "@/modules/learning/profile";
import { myLearning } from "@/modules/learning/progress";
import { mediaUrl } from "@/modules/media/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: noindex };

export default async function AccountPage({ params, searchParams }: PageProps<"/[lang]/account">) {
  const { locale, dict } = await authPage(params);
  const user = await getCurrentUser();
  const here = localizePath("/account", locale);
  if (!user) redirect(`${localizePath("/login", locale)}?next=${encodeURIComponent(here)}`);
  const t = dict.account;
  const c = dict.courses;
  const sp = await searchParams;
  const [learning, profile] = await Promise.all([myLearning(user.id), profileOf(user.id)]);
  const enrolled = learning.filter((l) => l.enrollment.status === "APPROVED");
  const requests = learning.filter((l) => l.enrollment.status !== "APPROVED");
  const dateFmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });
  const statusLabel = { REQUESTED: t.statusRequested, REJECTED: t.statusRejected, REVOKED: t.statusRevoked, APPROVED: "" } as const;

  return (
    <Section>
      <div className="space-y-10">
        {sp.verified && <FormAlert tone="success">{dict.auth.verifiedNotice}</FormAlert>}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{t.title}</p>
            <h1 className="mt-2 text-3xl font-bold text-charcoal-900" dir="auto">{format(t.welcome, { name: user.name })}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {can(user.role, "admin.access") && <LinkButton href="/admin" variant="secondary">{t.adminLink}</LinkButton>}
            <LogoutButton label={dict.auth.logout} redirectTo={localizePath("/", locale)} />
          </div>
        </div>

        <section aria-labelledby="my-courses">
          <h2 id="my-courses" className="text-xl font-bold text-charcoal-900">{t.myCourses}</h2>
          {enrolled.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-surface-alt p-6">
              <p className="text-charcoal-900">{t.noCourses}</p>
              <LinkButton href={localizePath("/courses", locale)} className="mt-4">{t.browseCourses}</LinkButton>
            </div>
          ) : (
            <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {enrolled.map(({ course, enrollment, percent, done, total, lastLesson, canLearn }) => {
                const text = listingText(course, locale);
                return (
                  <li key={enrollment.id} className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                    <div className="relative aspect-video bg-charcoal-800">
                      {course.thumbnail?.visibility === "PUBLIC" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(course.thumbnail)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <h3 className="font-semibold text-charcoal-900" dir="auto">
                        <Link href={localizePath(`/courses/${course.slug}`, locale)} className="hover:underline">{text.title}</Link>
                      </h3>
                      <div>
                        <div className="h-2 overflow-hidden rounded-full bg-charcoal-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={text.title}>
                          <div className="h-full rounded-full bg-sun-400" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {total > 0 && done === total ? t.completed : format(t.progress, { percent: String(percent) })}
                        </p>
                      </div>
                      {lastLesson && <p className="text-xs text-muted" dir="auto">{format(t.lastLesson, { lesson: lastLesson.title })}</p>}
                      <div className="mt-auto">
                        {canLearn ? (
                          <LinkButton href={localizePath(`/learn/${course.slug}`, locale)} className="w-full py-2">{lastLesson ? t.continue : t.start}</LinkButton>
                        ) : (
                          <p className="text-xs text-muted">{dict.learn.unavailable}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {requests.length > 0 && (
          <section aria-labelledby="requests">
            <h2 id="requests" className="text-xl font-bold text-charcoal-900">{t.requests}</h2>
            <ul className="mt-4 divide-y divide-line rounded-2xl ring-1 ring-line">
              {requests.map(({ course, enrollment }) => (
                <li key={enrollment.id} className="flex flex-wrap items-start justify-between gap-3 p-5 text-sm">
                  <div className="min-w-0">
                    <Link href={localizePath(`/courses/${course.slug}`, locale)} className="font-semibold text-charcoal-900 hover:underline" dir="auto">
                      {listingText(course, locale).title}
                    </Link>
                    <p className="mt-1 text-xs text-muted">{format(t.requestedOn, { date: dateFmt.format(enrollment.requestedAt) })}</p>
                    {enrollment.decisionNote && <p className="mt-2 text-charcoal-800" dir="auto">{format(c.reason, { note: enrollment.decisionNote })}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enrollment.status === "REQUESTED" ? "bg-sun-100 text-charcoal-900" : "bg-charcoal-100 text-charcoal-800"}`}>
                    {statusLabel[enrollment.status]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="profile" className="rounded-2xl p-6 ring-1 ring-line">
          <h2 id="profile" className="text-xl font-bold text-charcoal-900">{t.profile}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{dict.auth.email}</dt>
              <dd dir="ltr" className="text-start">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">{dict.auth.googleEmail}</dt>
              <dd dir="ltr" className="text-start">{profile?.googleEmail ?? "-"}</dd>
            </div>
          </dl>
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">{t.editProfile}</summary>
            <div className="mt-4">
              <ProfileForm
                lang={locale}
                profile={{
                  name: profile?.name ?? user.name,
                  googleEmail: profile?.googleEmail ?? user.email,
                  phone: profile?.phone ?? "",
                  city: profile?.city ?? "",
                  preferredLocale: profile?.preferredLocale ?? "en",
                }}
                labels={{
                  name: dict.auth.name,
                  googleEmail: dict.auth.googleEmail,
                  googleHint: dict.courses.requestGoogleHint,
                  phone: dict.auth.phone,
                  city: dict.auth.city,
                  language: t.preferredLanguage,
                  save: t.saveProfile,
                }}
              />
            </div>
          </details>
        </section>
      </div>
    </Section>
  );
}
