import "server-only";
import { db } from "@/lib/db";
import { canManageCourse } from "@/modules/auth/scoping";
import type { CurrentUser } from "@/modules/auth/session";
import { courseBySlug, LEARNABLE, lessonsOf, type FullCourse } from "./catalogue";

/**
 * Who may open a course's lessons:
 * - "student": approved enrollment, course published or archived (checked on every request,
 *   so revoking access or unpublishing takes effect immediately)
 * - "staff":   manages the course (progress isn't recorded)
 * - "preview": anyone, for lessons marked as free preview on a published course
 */
export type LearnMode = "student" | "staff" | "preview";

export async function learnerContext(user: Pick<CurrentUser, "id" | "role"> | null, slug: string) {
  const course = await courseBySlug(slug);
  if (!course) return null;
  if (user && (await canManageCourse(user, course.id))) return { course, mode: "staff" as const, enrollment: null };
  const enrollment = user ? await db().enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null;
  const learnable = (LEARNABLE as readonly string[]).includes(course.status);
  if (enrollment?.status === "APPROVED" && learnable) return { course, mode: "student" as const, enrollment };
  if (course.status === "PUBLISHED") return { course, mode: "preview" as const, enrollment };
  return { course, mode: null, enrollment };
}

export function canOpenLesson(mode: LearnMode | null, lesson: { isPreview: boolean }) {
  return mode === "student" || mode === "staff" || (mode === "preview" && lesson.isPreview);
}

export async function completedLessonIds(userId: string, course: FullCourse) {
  const rows = await db().lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonsOf(course).map((l) => l.id) }, completedAt: { not: null } },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}

export async function recordView(userId: string, lessonId: string) {
  await db().lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: { lastViewedAt: new Date() },
  });
}

/** Marks a lesson (not) complete for an enrolled student; returns the course progress. */
export async function setLessonComplete(user: Pick<CurrentUser, "id" | "role">, slug: string, lessonId: string, done: boolean) {
  const ctx = await learnerContext(user, slug);
  if (!ctx || ctx.mode !== "student" || !ctx.enrollment) return null;
  const lessons = lessonsOf(ctx.course);
  if (!lessons.some((l) => l.id === lessonId)) return null;
  const completedAt = done ? new Date() : null;
  await db().lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId, completedAt },
    update: { completedAt },
  });
  const completed = await completedLessonIds(user.id, ctx.course);
  const all = lessons.length > 0 && lessons.every((l) => completed.has(l.id));
  // Enrollment.completedAt records the first time every lesson was finished.
  if (all && !ctx.enrollment.completedAt) await db().enrollment.update({ where: { id: ctx.enrollment.id }, data: { completedAt: new Date() } });
  return { done: completed.size, total: lessons.length, all };
}

/** Where "Continue" goes: last viewed lesson, else the first unfinished one, else the first. */
export async function continueLessonId(userId: string, course: FullCourse) {
  const lessons = lessonsOf(course);
  if (lessons.length === 0) return null;
  const ids = lessons.map((l) => l.id);
  const last = await db().lessonProgress.findFirst({ where: { userId, lessonId: { in: ids } }, orderBy: { lastViewedAt: "desc" } });
  if (last) return last.lessonId;
  const done = await completedLessonIds(userId, course);
  return (lessons.find((l) => !done.has(l.id)) ?? lessons[0]!).id;
}

/** Student dashboard: every enrollment with live progress. */
export async function myLearning(userId: string) {
  const enrollments = await db().enrollment.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      course: {
        include: {
          thumbnail: { select: { id: true, storageKey: true, visibility: true } },
          modules: { orderBy: { position: "asc" }, select: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true } } } },
        },
      },
    },
  });
  const lessonIds = enrollments.flatMap((e) => e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)));
  const progress = lessonIds.length
    ? await db().lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } }, orderBy: { lastViewedAt: "desc" } })
    : [];
  return enrollments.map((e) => {
    const lessons = e.course.modules.flatMap((m) => m.lessons);
    const ids = new Set(lessons.map((l) => l.id));
    const mine = progress.filter((p) => ids.has(p.lessonId));
    const done = mine.filter((p) => p.completedAt).length;
    const last = mine[0] ? lessons.find((l) => l.id === mine[0]!.lessonId) : undefined;
    return {
      enrollment: e,
      course: e.course,
      total: lessons.length,
      done,
      percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
      lastLesson: last ?? null,
      canLearn: e.status === "APPROVED" && (LEARNABLE as readonly string[]).includes(e.course.status),
    };
  });
}

/** Private resource files: approved students of a learnable course that uses the file. */
export async function studentCanDownload(userId: string, mediaAssetId: string) {
  const hit = await db().courseResource.findFirst({
    where: {
      mediaAssetId,
      course: { status: { in: [...LEARNABLE] }, enrollments: { some: { userId, status: "APPROVED" } } },
    },
    select: { id: true },
  });
  return !!hit;
}
