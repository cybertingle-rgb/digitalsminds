import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { canManageCourse, manageableCoursesWhere } from "@/modules/auth/scoping";
import type { CurrentUser } from "@/modules/auth/session";
import { mediaScope } from "@/modules/media/service";
import { courseDetailsInput, newCourseInput, slugify } from "./schema";

export class CourseError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CourseError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

async function requireCourse(courseId: string, actor: Actor) {
  if (!(await canManageCourse(actor, courseId))) throw new CourseError("Course not found.", 404);
  const course = await db().course.findUnique({ where: { id: courseId } });
  if (!course) throw new CourseError("Course not found.", 404);
  return course;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function listCourses(actor: Actor, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  return db().course.findMany({
    where: { AND: [manageableCoursesWhere(actor), status ? { status } : {}] },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      thumbnail: { select: { storageKey: true, visibility: true, id: true } },
      _count: { select: { batches: true, enrollments: true } },
    },
  });
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = base || `course-${randomUUID().slice(0, 6)}`;
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db().course.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!clash) return slug;
  }
  return `${root}-${randomUUID().slice(0, 6)}`;
}

export async function createCourse(input: z.infer<typeof newCourseInput>, actor: Actor) {
  if (!can(actor.role, "courses.manage.all") && !can(actor.role, "courses.manage.own")) throw new CourseError("You can't create courses.", 403);
  const course = await db().course.create({
    data: {
      title: input.title,
      language: input.language,
      summary: input.summary,
      slug: await uniqueSlug(slugify(input.title)),
      createdById: actor.id,
    },
  });
  await audit({ actorId: actor.id, action: "course.created", entityType: "Course", entityId: course.id, metadata: { title: course.title } });
  return course;
}

export async function getCourseForEdit(courseId: string, actor: Actor) {
  if (!(await canManageCourse(actor, courseId))) return null;
  return db().course.findUnique({
    where: { id: courseId },
    include: {
      thumbnail: true,
      _count: { select: { enrollments: true, certificates: true, batches: true, applications: true } },
    },
  });
}

export type CourseForEdit = NonNullable<Awaited<ReturnType<typeof getCourseForEdit>>>;

export async function updateCourseDetails(courseId: string, input: z.infer<typeof courseDetailsInput>, actor: Actor) {
  const course = await requireCourse(courseId, actor);
  if (course.publishedAt && input.slug !== course.slug) {
    throw new CourseError("The web address can't change after a course has been published, so shared links keep working.");
  }
  if (input.thumbnailId && input.thumbnailId !== course.thumbnailId) {
    const img = await db().mediaAsset.findFirst({ where: { id: input.thumbnailId, ...mediaScope(actor) } });
    if (!img || img.visibility !== "PUBLIC" || !img.mimeType.startsWith("image/")) throw new CourseError("Choose a public image from the Media library as the thumbnail.");
  }
  if (input.categoryId && !(await db().programCategory.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    throw new CourseError("Choose an existing category.");
  }
  try {
    await db().course.update({ where: { id: courseId }, data: { ...input, objectives: input.objectives } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new CourseError("Another course already uses this web address. Choose a different one.");
    throw e;
  }
  await audit({ actorId: actor.id, action: "course.updated", entityType: "Course", entityId: courseId });
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export function publishChecklist(course: CourseForEdit) {
  return [
    { ok: course.title.length >= 3 && course.summary.length >= 10, label: "Title and summary" },
    { ok: course.accessType === "PAID" && !!course.priceAmount, label: "Enrollment fee set (Super Admin)" },
  ];
}

/** Recommended but not required before publishing. */
export function publishWarnings(course: CourseForEdit & { _count: { batches?: number } }) {
  return [
    !course.thumbnailId && "No image: the program will show a plain placeholder.",
    !course.description && "No description: visitors see only the short summary.",
    !course._count.batches && "No batches yet: visitors can read about the program but can't apply until a batch is open.",
  ].filter((w): w is string => !!w);
}

export async function setCourseStatus(courseId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", actor: Actor) {
  if (!can(actor.role, "courses.publish")) throw new CourseError("Ask a Content Manager or Super Admin to publish, unpublish or archive courses.", 403);
  const course = await getCourseForEdit(courseId, actor);
  if (!course) throw new CourseError("Course not found.", 404);
  if (status === "PUBLISHED") {
    const failing = publishChecklist(course).filter((c) => !c.ok);
    if (failing.length) throw new CourseError(`Not ready to publish: ${failing.map((f) => f.label).join("; ")}.`);
  }
  await db().course.update({
    where: { id: courseId },
    data: { status, ...(status === "PUBLISHED" && !course.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  const action = { DRAFT: "course.unpublished", PUBLISHED: "course.published", ARCHIVED: "course.archived" }[status];
  await audit({ actorId: actor.id, action, entityType: "Course", entityId: courseId, metadata: { title: course.title } });
}

export async function deleteCourse(courseId: string, actor: Actor) {
  const course = await getCourseForEdit(courseId, actor);
  if (!course) throw new CourseError("Course not found.", 404);
  if (course.status !== "DRAFT") throw new CourseError("Only draft courses can be deleted. Archive published courses instead.");
  if (course._count.enrollments > 0 || course._count.certificates > 0 || course._count.batches > 0 || course._count.applications > 0) {
    throw new CourseError("Batches or students are linked to this program, so it can only be archived.");
  }
  await db().course.delete({ where: { id: courseId } });
  await audit({ actorId: actor.id, action: "course.deleted", entityType: "Course", entityId: courseId, metadata: { title: course.title } });
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export function pickableMedia(actor: Actor) {
  return db().mediaAsset.findMany({
    where: mediaScope(actor),
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, originalName: true, mimeType: true, visibility: true, storageKey: true },
  });
}
