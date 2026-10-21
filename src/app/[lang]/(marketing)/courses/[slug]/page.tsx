import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, lessonCount } from "@/components/learning/format";
import { RequestAccessForm } from "@/components/learning/RequestAccessForm";
import { FormAlert } from "@/components/forms/Field";
import { JsonLd } from "@/components/seo/JsonLd";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { hasLocale, localeMeta, localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { pageMetadata } from "@/i18n/metadata";
import { courseAnnouncements } from "@/modules/announcements/service";
import { getCurrentUser } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { courseBySlug, lessonsOf, listingText, objectivesOf, totalMinutes } from "@/modules/learning/catalogue";
import { learnerContext } from "@/modules/learning/progress";
import { mediaUrl } from "@/modules/media/service";
import { coursePrice, formatPkr } from "@/modules/payments/service";
import { absolute, breadcrumbs, orgRef } from "@/modules/seo/structured-data";

export const dynamic = "force-dynamic";

type Props = PageProps<"/[lang]/courses/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const course = await courseBySlug(slug).catch(() => null);
  if (!course || course.status !== "PUBLISHED") return { robots: { index: false, follow: false } };
  const text = listingText(course, lang);
  const meta = pageMetadata(lang, `/courses/${slug}`, {
    title: (lang === "en" && course.seoTitle) || text.title,
    description: (lang === "en" && course.seoDescription) || text.summary,
  });
  if (course.thumbnail?.visibility === "PUBLIC" && meta.openGraph) {
    meta.openGraph.images = [{ url: mediaUrl(course.thumbnail), ...(course.thumbnail.width && { width: course.thumbnail.width, height: course.thumbnail.height ?? undefined }) }];
  }
  return meta;
}

export default async function CoursePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.courses;
  const user = await getCurrentUser();
  const ctx = await learnerContext(user, slug);
  if (!ctx) notFound();
  const { course, mode, enrollment } = ctx;
  // Drafts and archived courses are only shown to their staff and enrolled students.
  if (course.status !== "PUBLISHED" && mode !== "staff" && mode !== "student") notFound();

  const text = listingText(course, lang);
  const lessons = lessonsOf(course);
  const objectives = objectivesOf(course.objectives);
  const courseDir = localeMeta[course.language].dir;
  const learnHref = (lessonId?: string) => localizePath(`/learn/${course.slug}${lessonId ? `/${lessonId}` : ""}`, lang);
  const canOpenAll = mode === "student" || mode === "staff";
  const news = canOpenAll ? await courseAnnouncements(course.id) : [];
  const price = coursePrice(course);
  const structured =
    course.status === "PUBLISHED"
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: text.title,
            description: text.summary,
            url: absolute(localizePath(`/courses/${course.slug}`, lang)),
            inLanguage: localeMeta[course.language].htmlLang,
            provider: await orgRef(dict),
            ...(price ? { offers: { "@type": "Offer", price: (price / 100).toFixed(0), priceCurrency: "PKR", category: "Paid" } } : { isAccessibleForFree: true }),
            ...(course.thumbnail?.visibility === "PUBLIC" && { image: absolute(mediaUrl(course.thumbnail)) }),
            ...(course.instructors.length && { instructor: course.instructors.map((i) => ({ "@type": "Person", name: i.user.name })) }),
          },
          breadcrumbs(lang, [
            { name: dict.nav.home, path: "/" },
            { name: t.title, path: "/courses" },
            { name: text.title, path: `/courses/${course.slug}` },
          ]),
        ]
      : [];

  return (
    <>
      {structured.length > 0 && <JsonLd data={structured} />}
      <Section tone="alt" className="!py-12">
        <nav aria-label={dict.a11y.breadcrumb} className="text-sm text-muted">
          <Link href={localizePath("/courses", lang)} className="hover:text-charcoal-900">{t.title}</Link> /{" "}
          <span className="text-charcoal-900" dir="auto">{text.title}</span>
        </nav>
        <div className="mt-6 grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3">
            <h1 className="text-3xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-4xl" dir="auto">{text.title}</h1>
            <p className="mt-4 text-lg text-muted" dir="auto">{text.summary}</p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm">
              {[price ? formatPkr(price) : t.free, t.levels[course.level], t.languages[course.language], lessonCount(lessons.length, dict), formatDuration(totalMinutes(course), dict), course.certificateEnabled ? t.certificate : null]
                .filter(Boolean)
                .map((m) => <li key={m} className="glass-subtle rounded-full px-3 py-1 font-medium text-charcoal-800">{m}</li>)}
            </ul>
            {course.instructors.length > 0 && (
              <p className="mt-4 text-sm text-muted">{t.instructors}: {course.instructors.map((i) => i.user.name).join(", ")}</p>
            )}
          </div>
          {course.thumbnail?.visibility === "PUBLIC" && (
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-charcoal-100 lg:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(course.thumbnail)} alt={(lang === "ur" ? course.thumbnail.altTextUr : null) ?? course.thumbnail.altText ?? ""} className="absolute inset-0 h-full w-full object-cover" />
            </div>
          )}
        </div>
      </Section>

      <Section className="!py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="min-w-0 space-y-10 lg:col-span-2" dir={courseDir} lang={course.language}>
            {objectives.length > 0 && (
              <section aria-labelledby="learn-title" className="glass rounded-2xl p-6">
                <h2 id="learn-title" className="text-xl font-bold text-charcoal-900">{t.whatYouLearn}</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {objectives.map((o) => (
                    <li key={o} className="flex gap-3 text-charcoal-800">
                      <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sun-400 text-xs font-bold text-charcoal-900">✓</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {course.description && (
              <section aria-labelledby="about-title">
                <h2 id="about-title" className="text-xl font-bold text-charcoal-900">{t.about}</h2>
                <RichText text={course.description} className="mt-4 text-charcoal-800" />
              </section>
            )}
            {course.prerequisites && (
              <section aria-labelledby="pre-title">
                <h2 id="pre-title" className="text-xl font-bold text-charcoal-900">{t.beforeYouStart}</h2>
                <RichText text={course.prerequisites} className="mt-4 text-charcoal-800" />
              </section>
            )}
            <section aria-labelledby="contents-title">
              <h2 id="contents-title" className="text-xl font-bold text-charcoal-900">{t.contents}</h2>
              <ol className="mt-4 space-y-4">
                {course.modules.filter((m) => m.lessons.length).map((m) => (
                  <li key={m.id} className="glass overflow-hidden rounded-2xl">
                    <h3 className="bg-white/50 px-5 py-3 font-semibold text-charcoal-900">{m.title}</h3>
                    <ol className="divide-y divide-line">
                      {m.lessons.map((l) => {
                        const open = canOpenAll || l.isPreview;
                        return (
                          <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                            {open ? (
                              <Link href={learnHref(l.id)} className="font-medium text-charcoal-900 underline-offset-4 hover:underline">{l.title}</Link>
                            ) : (
                              <span className="text-charcoal-800">{l.title}</span>
                            )}
                            <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                              {l.isPreview && !canOpenAll && <span className="rounded-full bg-sun-100 px-2 py-0.5 font-semibold text-charcoal-900">{t.preview}</span>}
                              {formatDuration(l.durationMinutes, dict)}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="space-y-4 glass rounded-2xl p-6" aria-labelledby="access-title">
              <h2 id="access-title" className="text-lg font-bold text-charcoal-900">{t.accessTitle}</h2>
              <AccessPanel
                lang={lang}
                dict={dict}
                mode={mode}
                status={enrollment?.status ?? null}
                decisionNote={enrollment?.decisionNote ?? null}
                courseId={course.id}
                price={price}
                payHref={localizePath(`/courses/${course.slug}/pay`, lang)}
                loggedIn={!!user}
                googleEmail={user?.googleEmail ?? user?.email ?? ""}
                here={localizePath(`/courses/${course.slug}`, lang)}
                learnHref={learnHref()}
                published={course.status === "PUBLISHED"}
              />
            </div>
            {news.length > 0 && (
              <section aria-labelledby="course-news" className="space-y-4 glass rounded-2xl p-6">
                <h2 id="course-news" className="text-lg font-bold text-charcoal-900">{dict.announcements.title}</h2>
                {news.map((a) => (
                  <article key={a.id} dir={localeMeta[course.language].dir} lang={course.language}>
                    <h3 className="font-semibold text-charcoal-900">{a.title}</h3>
                    <RichText text={a.body} className="mt-1 text-sm text-charcoal-800" />
                  </article>
                ))}
              </section>
            )}
          </aside>
        </div>
      </Section>
    </>
  );
}

function AccessPanel(p: {
  lang: Locale;
  dict: ReturnType<typeof getDictionary>;
  mode: "student" | "staff" | "preview" | null;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED" | null;
  decisionNote: string | null;
  courseId: string;
  /** Fee in paisa for paid courses. */
  price: number | null;
  payHref: string;
  loggedIn: boolean;
  googleEmail: string;
  here: string;
  learnHref: string;
  published: boolean;
}) {
  const t = p.dict.courses;
  if (p.mode === "staff") {
    return (
      <>
        <p className="text-sm text-muted">{t.staffNote}</p>
        <LinkButton href={p.learnHref} variant="dark" className="w-full">{t.openAsStaff}</LinkButton>
      </>
    );
  }
  if (p.mode === "student") {
    return (
      <>
        <FormAlert tone="success">{t.approved}</FormAlert>
        <LinkButton href={p.learnHref} className="w-full">{t.continue}</LinkButton>
      </>
    );
  }
  if (!p.published) return <p className="text-sm text-muted">{t.notAvailable}</p>;
  if (p.price) return <PaidAccess {...p} price={p.price} />;
  if (!p.loggedIn) {
    return (
      <>
        <p className="text-sm text-muted">{t.accessIntro}</p>
        <LinkButton href={`${localizePath("/login", p.lang)}?next=${encodeURIComponent(p.here)}`} className="w-full">{t.loginToRequest}</LinkButton>
        <LinkButton href={localizePath("/register", p.lang)} variant="secondary" className="w-full">{t.registerToRequest}</LinkButton>
      </>
    );
  }
  if (p.status === "REQUESTED") return <FormAlert tone="info">{t.pending}</FormAlert>;
  return (
    <>
      {(p.status === "REJECTED" || p.status === "REVOKED") && (
        <div className="space-y-1 glass-subtle rounded-xl p-4 text-sm text-charcoal-900">
          <p className="font-semibold">{p.status === "REJECTED" ? t.rejected : t.revoked}</p>
          {p.decisionNote && <p dir="auto">{format(t.reason, { note: p.decisionNote })}</p>}
        </div>
      )}
      <p className="text-sm text-muted">{t.accessIntro}</p>
      <RequestAccessForm
        lang={p.lang}
        courseId={p.courseId}
        googleEmail={p.googleEmail}
        labels={{ googleEmail: t.requestGoogleEmail, googleHint: t.requestGoogleHint, note: t.requestNote, submit: p.status ? t.requestAgain : t.requestButton }}
      />
    </>
  );
}

/** Paid courses: pay, send the details, and wait for confirmation. */
function PaidAccess(p: Parameters<typeof AccessPanel>[0] & { price: number }) {
  const t = p.dict.payments;
  const amount = formatPkr(p.price);
  return (
    <>
      <p className="text-2xl font-bold text-charcoal-900" dir="ltr">{amount}</p>
      {!p.loggedIn ? (
        <>
          <p className="text-sm text-muted">{t.accessIntroPaid}</p>
          <LinkButton href={`${localizePath("/login", p.lang)}?next=${encodeURIComponent(p.payHref)}`} className="w-full">{t.loginToEnroll}</LinkButton>
          <LinkButton href={localizePath("/register", p.lang)} variant="secondary" className="w-full">{t.registerToEnroll}</LinkButton>
        </>
      ) : p.status === "REQUESTED" ? (
        <FormAlert tone="info">{t.pending}</FormAlert>
      ) : (
        <>
          {(p.status === "REJECTED" || p.status === "REVOKED") && (
            <div className="space-y-1 glass-subtle rounded-xl p-4 text-sm text-charcoal-900">
              <p className="font-semibold">{p.status === "REJECTED" ? t.rejectedTitle : p.dict.courses.revoked}</p>
              {p.decisionNote && <p dir="auto">{p.decisionNote}</p>}
            </div>
          )}
          <p className="text-sm text-muted">{t.accessIntroPaid}</p>
          <LinkButton href={p.payHref} className="w-full">{format(t.enrollButton, { amount })}</LinkButton>
        </>
      )}
    </>
  );
}
