import "server-only";
import type { Locale } from "@/i18n/config";
import { db } from "@/lib/db";

/** Statuses in which approved students can keep learning (archived = closed to new students). */
export const LEARNABLE = ["PUBLISHED", "ARCHIVED"] as const;

/** Catalogue text in the visitor's language; Urdu falls back to English until added. */
export function listingText(course: { title: string; titleUr: string | null; summary: string; summaryUr: string | null }, locale: Locale) {
  return locale === "ur"
    ? { title: course.titleUr || course.title, summary: course.summaryUr || course.summary }
    : { title: course.title, summary: course.summary };
}

export function objectivesOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((o): o is string => typeof o === "string") : [];
}

export async function publishedCourses() {
  const courses = await db().course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { publishedAt: "desc" }],
    include: { thumbnail: { select: { id: true, storageKey: true, visibility: true, altText: true } }, category: { select: { id: true, slug: true, title: true, titleUr: true, sortOrder: true, active: true } } },
  });
  return courses;
}

/** Full course with curriculum, for the public page and the lesson player. */
export function courseBySlug(slug: string) {
  return db().course.findUnique({
    where: { slug },
    include: {
      thumbnail: true,
      category: true,
      instructors: { include: { user: { select: { name: true } } } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { resources: { orderBy: { position: "asc" }, include: { mediaAsset: true } } },
          },
        },
      },
      resources: { where: { lessonId: null }, orderBy: { position: "asc" }, include: { mediaAsset: true } },
    },
  });
}

export type FullCourse = NonNullable<Awaited<ReturnType<typeof courseBySlug>>>;

export function lessonsOf(course: FullCourse) {
  return course.modules.flatMap((m) => m.lessons);
}

export function totalMinutes(course: FullCourse) {
  return course.durationMinutes ?? (lessonsOf(course).reduce((s, l) => s + (l.durationMinutes ?? 0), 0) || null);
}
