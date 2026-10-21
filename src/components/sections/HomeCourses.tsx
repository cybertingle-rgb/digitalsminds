import { CourseCard } from "@/components/learning/CourseCard";
import { programMeta } from "@/components/learning/format";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { listingText, publishedCourses } from "@/modules/learning/catalogue";
import { mediaUrl } from "@/modules/media/service";
import { nextOpenBatchByCourse } from "@/modules/batches/service";

/** Up to three published courses; the section is left out until one is published. */
export async function HomeCourses({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const courses = await publishedCourses().catch(() => []);
  if (courses.length === 0) return null;
  const nextBatch = await nextOpenBatchByCourse(courses.slice(0, 3).map((c) => c.id)).catch(() => new Map<string, Date>());
  return (
    <Section tone="alt">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow={dict.home.coursesEyebrow} title={dict.home.coursesTitle} description={dict.home.coursesDescription} />
        <LinkButton href={localizePath("/courses", locale)} variant="secondary">{dict.home.coursesAll}</LinkButton>
      </div>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {courses.slice(0, 3).map((c) => {
          const text = listingText(c, locale);
          return (
            <li key={c.id}>
              <CourseCard
                href={localizePath(`/courses/${c.slug}`, locale)}
                title={text.title}
                summary={text.summary}
                thumbnailUrl={c.thumbnail ? mediaUrl(c.thumbnail) : null}
                courseLang={c.language}
                meta={programMeta(c, nextBatch.get(c.id), dict)}
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
