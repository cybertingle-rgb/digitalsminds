import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAlert } from "@/components/forms/Field";
import { JsonLd } from "@/components/seo/JsonLd";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { hasLocale, localeMeta, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { pageMetadata } from "@/i18n/metadata";
import { getCurrentUser } from "@/modules/auth/session";
import { formatDay } from "@/modules/batches/rules";
import { publicBatches } from "@/modules/batches/service";
import { RichText } from "@/modules/courses/richtext";
import { db } from "@/lib/db";
import { courseBySlug, listingText, objectivesOf } from "@/modules/learning/catalogue";
import { mediaUrl } from "@/modules/media/service";
import { coursePrice, formatPkr } from "@/modules/payments/service";
import { absolute, breadcrumbs, orgRef } from "@/modules/seo/structured-data";
import { zoneLabel, zoneName } from "@/lib/timezone";

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
  const a = dict.apply;
  const course = await courseBySlug(slug);
  if (!course || course.status !== "PUBLISHED") notFound();
  const user = await getCurrentUser();
  const [batches, enrolled] = await Promise.all([
    publicBatches(course.id),
    user ? db().enrollment.findFirst({ where: { userId: user.id, courseId: course.id, stage: { in: ["ENROLLMENT_CONFIRMED", "ONBOARDING", "ACTIVE"] } }, select: { id: true } }) : null,
  ]);

  const text = listingText(course, lang);
  const objectives = objectivesOf(course.objectives);
  const courseDir = localeMeta[course.language].dir;
  const price = coursePrice(course);
  const applyHref = (batchId: string) => `${localizePath(`/courses/${course.slug}/apply`, lang)}?batch=${batchId}`;
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: text.title,
      description: text.summary,
      url: absolute(localizePath(`/courses/${course.slug}`, lang)),
      inLanguage: localeMeta[course.language].htmlLang,
      provider: await orgRef(dict),
      ...(price && { offers: { "@type": "Offer", price: (price / 100).toFixed(0), priceCurrency: "PKR", category: "Paid" } }),
      ...(course.thumbnail?.visibility === "PUBLIC" && { image: absolute(mediaUrl(course.thumbnail)) }),
    },
    breadcrumbs(lang, [
      { name: dict.nav.home, path: "/" },
      { name: t.title, path: "/courses" },
      { name: text.title, path: `/courses/${course.slug}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={structured} />
      <Section tone="alt" className="!py-12">
        <nav aria-label={dict.a11y.breadcrumb} className="text-sm text-muted">
          <Link href={localizePath("/courses", lang)} className="hover:text-charcoal-900">{t.title}</Link> /{" "}
          <span className="text-charcoal-900" dir="auto">{text.title}</span>
        </nav>
        <div className="mt-6 grid gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-3">
            {course.category?.active && (
              <Link href={`${localizePath("/courses", lang)}?category=${course.category.slug}`} className="mb-3 inline-block text-xs font-semibold uppercase tracking-wider text-gold-700 hover:underline">
                {(lang === "ur" && course.category.titleUr) || course.category.title}
              </Link>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-4xl" dir="auto">{text.title}</h1>
            <p className="mt-4 text-lg text-muted" dir="auto">{text.summary}</p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm">
              {price && <li className="glass-subtle rounded-full px-3 py-1 font-medium text-charcoal-800" dir="ltr">{formatPkr(price)}</li>}
              {[t.formats[course.format], course.durationText, t.levels[course.level], t.languages[course.language], course.certificateEnabled ? t.certificate : null]
                .filter(Boolean)
                .map((m) => <li key={m} className="glass-subtle rounded-full px-3 py-1 font-medium text-charcoal-800">{m}</li>)}
            </ul>
          </div>
          {course.thumbnail?.visibility === "PUBLIC" && (
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-charcoal-100 lg:col-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(course.thumbnail)} alt={course.thumbnail.altText ?? ""} className="absolute inset-0 h-full w-full object-cover" />
            </div>
          )}
        </div>
      </Section>

      <Section className="!py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="min-w-0 space-y-10 lg:col-span-2">
            <section aria-labelledby="batches-title" id="batches" className="scroll-mt-28">
              <h2 id="batches-title" className="text-xl font-bold text-charcoal-900">{a.batchesTitle}</h2>
              <p className="mt-2 text-muted">{a.batchesIntro}</p>
              {batches.length === 0 ? (
                <p className="mt-4 glass-subtle rounded-2xl p-5 text-charcoal-800">{a.noBatches}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {batches.map((b) => (
                    <li key={b.id} className="glass flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5" aria-label={b.name}>
                      <div className="min-w-0">
                        <p className="font-semibold text-charcoal-900">{b.name}</p>
                        <p className="mt-1 text-sm text-charcoal-800">{b.scheduleText}
                          {/* Older batches wrote the zone into the text already. */}
                          {!b.scheduleText.includes(zoneLabel(b.timeZone, b.startDate)) && <span className="text-muted"> ({format(a.timesIn, { zone: zoneName(b.timeZone, b.startDate) })})</span>}</p>
                        <p className="mt-1 text-sm text-muted">
                          {format(a.starts, { date: formatDay(b.startDate) })}
                          {b.endDate && ` · ${format(a.ends, { date: formatDay(b.endDate) })}`}
                          {b.open === "open" && ` · ${format(a.deadline, { date: formatDay(b.applicationDeadline ?? b.startDate) })}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${b.open === "open" ? "bg-green-100 text-green-900" : "bg-charcoal-100 text-charcoal-700"}`}>
                          {b.open === "open"
                            ? b.seatsLeft === 1 ? a.oneSeatLeft : format(a.seatsLeft, { count: String(b.seatsLeft) })
                            : b.open === "full" ? a.full : b.status === "IN_PROGRESS" ? a.inProgress : a.closed}
                        </span>
                        {b.open === "open" && !enrolled && <LinkButton href={applyHref(b.id)}>{a.applyButton}</LinkButton>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {objectives.length > 0 && (
              <section aria-labelledby="learn-title" className="glass rounded-2xl p-6" dir={courseDir} lang={course.language}>
                <h2 id="learn-title" className="text-xl font-bold text-charcoal-900">{a.objectives}</h2>
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
              <section aria-labelledby="about-title" dir={courseDir} lang={course.language}>
                <h2 id="about-title" className="text-xl font-bold text-charcoal-900">{t.about}</h2>
                <RichText text={course.description} className="mt-4 text-charcoal-800" />
              </section>
            )}
            {course.prerequisites && (
              <section aria-labelledby="pre-title" dir={courseDir} lang={course.language}>
                <h2 id="pre-title" className="text-xl font-bold text-charcoal-900">{a.eligibility}</h2>
                <RichText text={course.prerequisites} className="mt-4 text-charcoal-800" />
              </section>
            )}
            {course.category?.active && course.category.notice && (
              <section aria-labelledby="notice-title" className="rounded-2xl border-s-4 border-sun-400 bg-white/60 p-5">
                <h2 id="notice-title" className="font-bold text-charcoal-900">{t.importantNotice}</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-charcoal-800">{course.category.notice}</p>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="glass space-y-4 rounded-2xl p-6" aria-labelledby="fee-title">
              <h2 id="fee-title" className="text-sm font-semibold uppercase tracking-wider text-gold-700">{a.fee}</h2>
              {price && <p className="text-3xl font-bold text-charcoal-900" dir="ltr">{formatPkr(price)}</p>}
              <p className="text-sm text-muted">{a.feeNote}</p>
              {enrolled ? (
                <>
                  <FormAlert tone="success">{a.enrolledNotice}</FormAlert>
                  <LinkButton href={localizePath("/account", lang)} className="w-full">{a.openPortal}</LinkButton>
                </>
              ) : (
                batches.some((b) => b.open === "open") && <LinkButton href="#batches" className="w-full">{a.applyButton}</LinkButton>
              )}
            </div>
            <section aria-labelledby="how-title" className="glass-subtle rounded-2xl p-6">
              <h2 id="how-title" className="text-lg font-bold text-charcoal-900">{a.howItWorks}</h2>
              <ol className="mt-4 space-y-3 text-sm text-charcoal-800">
                {a.steps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charcoal-900 text-xs font-bold text-sun-400">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      </Section>
    </>
  );
}
