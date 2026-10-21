import "server-only";
import { db } from "@/lib/db";
import { myLearning } from "./progress";

export type Activity =
  | { kind: "lesson"; at: Date; lesson: string; course: { title: string; titleUr: string | null }; slug: string }
  | { kind: "certificate"; at: Date; course: { title: string; titleUr: string | null }; code: string }
  | { kind: "enrolled"; at: Date; course: { title: string; titleUr: string | null }; slug: string };

/**
 * Everything the student dashboard shows, from the student's own records only:
 * course progress, totals, what to continue, and recent activity.
 */
export async function studentDashboard(userId: string) {
  const [learning, completed, certificates] = await Promise.all([
    myLearning(userId),
    db().lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 500,
      select: {
        completedAt: true,
        lesson: { select: { title: true, durationMinutes: true, module: { select: { course: { select: { slug: true, title: true, titleUr: true } } } } } },
      },
    }),
    db().certificate.findMany({ where: { userId, revokedAt: null }, orderBy: { issuedAt: "desc" }, select: { code: true, courseTitle: true, issuedAt: true, course: { select: { titleUr: true } } } }),
  ]);

  const enrolled = learning.filter((l) => l.enrollment.status === "APPROVED");
  const finished = (l: (typeof enrolled)[number]) => l.total > 0 && l.done === l.total;

  // The course with the most recently viewed lesson that the student can still open.
  const learnable = enrolled.filter((l) => l.canLearn);
  const continueWith = learnable.find((l) => l.lastLesson && !finished(l)) ?? learnable.find((l) => !finished(l)) ?? null;

  const activity: Activity[] = [
    ...completed.slice(0, 10).map((p) => ({ kind: "lesson" as const, at: p.completedAt!, lesson: p.lesson.title, course: p.lesson.module.course, slug: p.lesson.module.course.slug })),
    ...certificates.slice(0, 5).map((c) => ({ kind: "certificate" as const, at: c.issuedAt, course: { title: c.courseTitle, titleUr: c.course.titleUr }, code: c.code })),
    ...enrolled
      .filter((l) => l.enrollment.decidedAt)
      .slice(0, 5)
      .map((l) => ({ kind: "enrolled" as const, at: l.enrollment.decidedAt!, course: { title: l.course.title, titleUr: l.course.titleUr }, slug: l.course.slug })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

  return {
    learning,
    enrolled,
    stats: {
      inProgress: enrolled.filter((l) => !finished(l)).length,
      completedCourses: enrolled.filter(finished).length,
      lessonsDone: completed.length,
      /** Sum of the lengths of completed lessons (lessons without a length count as 0). */
      minutes: completed.reduce((sum, p) => sum + (p.lesson.durationMinutes ?? 0), 0),
      certificates: certificates.length,
    },
    continueWith,
    activity,
  };
}
