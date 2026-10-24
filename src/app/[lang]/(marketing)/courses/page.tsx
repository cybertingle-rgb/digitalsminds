import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseCard } from "@/components/learning/CourseCard";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { editablePageMetadata } from "@/modules/content/metadata";
import { listingText, publishedCourses } from "@/modules/learning/catalogue";
import { mediaUrl } from "@/modules/media/service";
import { programMeta } from "@/components/learning/format";
import { nextOpenBatchByCourse } from "@/modules/batches/service";
import { listCategories } from "@/modules/catalog/service";
import Link from "next/link";
import { coursePrice } from "@/modules/payments/format";
import { CurrencySwitcher } from "@/components/currency/CurrencySwitcher";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).courses;
  return editablePageMetadata("courses", lang, "/courses", { title: t.title, description: t.description });
}

export default async function CoursesPage({ params, searchParams }: PageProps<"/[lang]/courses">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.courses;
  const [all, categories] = await Promise.all([publishedCourses(), listCategories({ activeOnly: true }).catch(() => [])]);
  const requested = (await searchParams).category;
  const current = typeof requested === "string" ? categories.find((c) => c.slug === requested) : undefined;
  const courses = current ? all.filter((c) => c.categoryId === current.id) : all;
  const nextBatch = await nextOpenBatchByCourse(courses.map((c) => c.id));
  // Only categories that have published programs get a filter chip.
  const used = categories.filter((c) => all.some((p) => p.categoryId === c.id));
  const catTitle = (c: { title: string; titleUr: string | null }) => (lang === "ur" && c.titleUr) || c.title;
  const chip = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors";
  // Without a filter, programs are grouped by category (uncategorised last).
  const groups = current
    ? [{ key: current.id, title: null as string | null, notice: current.notice, items: courses }]
    : [
        ...used.map((c) => ({ key: c.id, title: catTitle(c), notice: null as string | null, items: courses.filter((p) => p.categoryId === c.id) })),
        { key: "other", title: used.length ? t.otherPrograms : null, notice: null as string | null, items: courses.filter((p) => !p.categoryId || !used.some((c) => c.id === p.categoryId)) },
      ].filter((g) => g.items.length > 0);

  return (
    <Section>
      <SectionHeading as="h1" title={current ? catTitle(current) : t.title} description={current ? ((lang === "ur" && current.summaryUr) || current.summary || t.description) : t.description} />
      {used.length > 1 && (
        <nav aria-label={t.filterLabel} className="mt-8 flex flex-wrap gap-2">
          <Link href={localizePath("/courses", lang)} aria-current={!current ? "page" : undefined} className={`${chip} ${!current ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-900 hover:bg-white"}`}>{t.allCategories}</Link>
          {used.map((c) => (
            <Link key={c.id} href={`${localizePath("/courses", lang)}?category=${c.slug}`} aria-current={current?.id === c.id ? "page" : undefined} className={`${chip} ${current?.id === c.id ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-900 hover:bg-white"}`}>
              {catTitle(c)}
            </Link>
          ))}
        </nav>
      )}
      <CurrencySwitcher className="mt-6" />
      {current?.notice && <p className="mt-6 max-w-3xl rounded-2xl border-s-4 border-sun-400 bg-white/60 px-5 py-4 text-sm text-charcoal-800">{current.notice}</p>}
      {courses.length === 0 ? (
        <div className="mt-10 glass-subtle rounded-2xl p-8 text-center">
          <p className="text-charcoal-900">{current ? t.categoryEmpty : t.empty}</p>
          <LinkButton href={localizePath("/contact", lang)} className="mt-4">{dict.nav.contact}</LinkButton>
        </div>
      ) : (
        groups.map((g) => (
        <section key={g.key} aria-label={g.title ?? undefined} className="mt-10">
        {g.title && <h2 className="mb-5 text-xl font-bold text-charcoal-900">{g.title}</h2>}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {g.items.map((c) => {
            const text = listingText(c, lang);
            return (
              <li key={c.id}>
                <CourseCard
                  href={localizePath(`/courses/${c.slug}`, lang)}
                  title={text.title}
                  summary={text.summary}
                  thumbnailUrl={c.thumbnail ? mediaUrl(c.thumbnail) : null}
                  courseLang={c.language}
                  meta={programMeta(c, nextBatch.get(c.id), dict)}
                  fee={coursePrice(c)}
                />
              </li>
            );
          })}
        </ul>
        </section>
        ))
      )}
    </Section>
  );
}
