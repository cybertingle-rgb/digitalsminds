import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseCard } from "@/components/learning/CourseCard";
import { formatDuration, lessonCount } from "@/components/learning/format";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { editablePageMetadata } from "@/modules/content/metadata";
import { listingText, publishedCourses } from "@/modules/learning/catalogue";
import { mediaUrl } from "@/modules/media/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/courses">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).courses;
  return editablePageMetadata("courses", lang, "/courses", { title: t.title, description: t.description });
}

export default async function CoursesPage({ params }: PageProps<"/[lang]/courses">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.courses;
  const courses = await publishedCourses();

  return (
    <Section>
      <SectionHeading as="h1" title={t.title} description={t.description} />
      {courses.length === 0 ? (
        <div className="mt-10 glass-subtle rounded-2xl p-8 text-center">
          <p className="text-charcoal-900">{t.empty}</p>
          <LinkButton href={localizePath("/contact", lang)} className="mt-4">{dict.nav.contact}</LinkButton>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => {
            const text = listingText(c, lang);
            return (
              <li key={c.id}>
                <CourseCard
                  href={localizePath(`/courses/${c.slug}`, lang)}
                  title={text.title}
                  summary={text.summary}
                  thumbnailUrl={c.thumbnail ? mediaUrl(c.thumbnail) : null}
                  courseLang={c.language}
                  meta={[t.free, t.levels[c.level], t.languages[c.language], lessonCount(c.lessonCount, dict), formatDuration(c.minutes, dict)]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
