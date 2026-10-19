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
import { driveFileId, driveViewUrl } from "./drive";
import { courseDetailsInput, lessonInput, moduleInput, newCourseInput, resourceInput, slugify } from "./schema";

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

async function moduleWithCourse(moduleId: string, actor: Actor) {
  const mod = await db().courseModule.findUnique({ where: { id: moduleId } });
  if (!mod) throw new CourseError("Module not found.", 404);
  await requireCourse(mod.courseId, actor);
  return mod;
}

async function lessonWithCourse(lessonId: string, actor: Actor) {
  const lesson = await db().lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson) throw new CourseError("Lesson not found.", 404);
  await requireCourse(lesson.module.courseId, actor);
  return lesson;
}

const changed = (actor: Actor, courseId: string, what: string) =>
  audit({ actorId: actor.id, action: "course.curriculum_changed", entityType: "Course", entityId: courseId, metadata: { what } });

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export function listCourses(actor: Actor, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  return db().course.findMany({
    where: { AND: [manageableCoursesWhere(actor), status ? { status } : {}] },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      thumbnail: { select: { storageKey: true, visibility: true, id: true } },
      instructors: { include: { user: { select: { name: true } } } },
      _count: { select: { modules: true, enrollments: true } },
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
      // Instructors own the courses they create.
      ...(can(actor.role, "courses.manage.all") ? {} : { instructors: { create: { userId: actor.id } } }),
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
      instructors: { include: { user: { select: { id: true, name: true, email: true } } } },
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { resources: { orderBy: { position: "asc" }, include: { mediaAsset: true } }, _count: { select: { progress: true } } },
          },
        },
      },
      resources: { where: { lessonId: null }, orderBy: { position: "asc" }, include: { mediaAsset: true } },
      _count: { select: { enrollments: true, certificates: true } },
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
  try {
    await db().course.update({ where: { id: courseId }, data: { ...input, objectives: input.objectives } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new CourseError("Another course already uses this web address. Choose a different one.");
    throw e;
  }
  await audit({ actorId: actor.id, action: "course.updated", entityType: "Course", entityId: courseId });
}

export async function setInstructors(courseId: string, userIds: string[], actor: Actor) {
  if (!can(actor.role, "courses.manage.all")) throw new CourseError("Only Content Managers and Super Admins assign instructors.", 403);
  await requireCourse(courseId, actor);
  const valid = await db().user.findMany({ where: { id: { in: userIds }, role: "INSTRUCTOR", status: "ACTIVE" }, select: { id: true } });
  if (valid.length !== new Set(userIds).size) throw new CourseError("Only active instructors can be assigned.");
  await db().$transaction([
    db().courseInstructor.deleteMany({ where: { courseId } }),
    db().courseInstructor.createMany({ data: valid.map((u) => ({ courseId, userId: u.id })) }),
  ]);
  await audit({ actorId: actor.id, action: "course.instructors_changed", entityType: "Course", entityId: courseId, metadata: { count: valid.length } });
}

export function availableInstructors() {
  return db().user.findMany({ where: { role: "INSTRUCTOR", status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export function publishChecklist(course: CourseForEdit) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const badVideos = lessons.filter((l) => l.videoUrl && !driveFileId(l.videoUrl));
  return [
    { ok: course.title.length >= 3 && course.summary.length >= 10, label: "Title and summary" },
    { ok: lessons.length > 0, label: "At least one lesson" },
    { ok: course.modules.every((m) => m.lessons.length > 0), label: "Every module has at least one lesson" },
    { ok: badVideos.length === 0, label: badVideos.length ? `Fix the video link in: ${badVideos.map((l) => l.title).join(", ")}` : "All video links are valid" },
  ];
}

/** Recommended but not required before publishing. */
export function publishWarnings(course: CourseForEdit) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  return [
    !course.thumbnailId && "No thumbnail image: the course will show a plain placeholder in the catalogue.",
    !course.description && "No description: students see only the short summary.",
    !course.titleUr && "No Urdu catalogue title yet: Urdu visitors will see the English title.",
    lessons.some((l) => !l.videoUrl && !l.content) && "Some lessons have neither a video nor text.",
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
  if (course._count.enrollments > 0 || course._count.certificates > 0) throw new CourseError("Students are linked to this course, so it can only be archived.");
  await db().course.delete({ where: { id: courseId } });
  await audit({ actorId: actor.id, action: "course.deleted", entityType: "Course", entityId: courseId, metadata: { title: course.title } });
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

export async function addModule(courseId: string, input: z.infer<typeof moduleInput>, actor: Actor) {
  await requireCourse(courseId, actor);
  const last = await db().courseModule.findFirst({ where: { courseId }, orderBy: { position: "desc" } });
  const mod = await db().courseModule.create({ data: { courseId, title: input.title, position: (last?.position ?? -1) + 1 } });
  await changed(actor, courseId, "module added");
  return mod;
}

export async function renameModule(moduleId: string, input: z.infer<typeof moduleInput>, actor: Actor) {
  const mod = await moduleWithCourse(moduleId, actor);
  await db().courseModule.update({ where: { id: moduleId }, data: { title: input.title } });
  await changed(actor, mod.courseId, "module renamed");
}

async function assertNoProgress(lessonIds: string[]) {
  if (lessonIds.length === 0) return;
  const used = await db().lessonProgress.count({ where: { lessonId: { in: lessonIds } } });
  if (used > 0) throw new CourseError("Students have progress on this content, so it can't be deleted. Edit it instead, or archive the course.");
}

export async function deleteModule(moduleId: string, actor: Actor) {
  const mod = await moduleWithCourse(moduleId, actor);
  const lessons = await db().lesson.findMany({ where: { moduleId }, select: { id: true } });
  await assertNoProgress(lessons.map((l) => l.id));
  await db().courseModule.delete({ where: { id: moduleId } });
  await changed(actor, mod.courseId, "module deleted");
}

/** Swap with the neighbour above or below. */
export async function moveModule(moduleId: string, direction: "up" | "down", actor: Actor) {
  const mod = await moduleWithCourse(moduleId, actor);
  const neighbour = await db().courseModule.findFirst({
    where: { courseId: mod.courseId, position: direction === "up" ? { lt: mod.position } : { gt: mod.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;
  await db().$transaction([
    db().courseModule.update({ where: { id: mod.id }, data: { position: neighbour.position } }),
    db().courseModule.update({ where: { id: neighbour.id }, data: { position: mod.position } }),
  ]);
}

export async function addLesson(moduleId: string, title: string, actor: Actor) {
  const mod = await moduleWithCourse(moduleId, actor);
  const last = await db().lesson.findFirst({ where: { moduleId }, orderBy: { position: "desc" } });
  const lesson = await db().lesson.create({ data: { moduleId, title, position: (last?.position ?? -1) + 1 } });
  await changed(actor, mod.courseId, "lesson added");
  return lesson;
}

export async function updateLesson(lessonId: string, input: z.infer<typeof lessonInput>, actor: Actor) {
  const lesson = await lessonWithCourse(lessonId, actor);
  let videoUrl: string | null = null;
  if (input.videoUrl) {
    const id = driveFileId(input.videoUrl);
    if (!id) throw new CourseError("That isn't a Google Drive video link. In Drive, open the video → Share → Copy link, and paste it here.");
    videoUrl = driveViewUrl(id);
  }
  await db().lesson.update({
    where: { id: lessonId },
    data: {
      title: input.title,
      content: input.content,
      durationMinutes: input.durationMinutes,
      isPreview: input.isPreview,
      videoUrl,
      videoProvider: videoUrl ? "GOOGLE_DRIVE" : "NONE",
    },
  });
  await changed(actor, lesson.module.courseId, "lesson updated");
}

export async function moveLesson(lessonId: string, direction: "up" | "down", actor: Actor) {
  const lesson = await lessonWithCourse(lessonId, actor);
  const neighbour = await db().lesson.findFirst({
    where: { moduleId: lesson.moduleId, position: direction === "up" ? { lt: lesson.position } : { gt: lesson.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;
  await db().$transaction([
    db().lesson.update({ where: { id: lesson.id }, data: { position: neighbour.position } }),
    db().lesson.update({ where: { id: neighbour.id }, data: { position: lesson.position } }),
  ]);
}

export async function moveLessonToModule(lessonId: string, targetModuleId: string, actor: Actor) {
  const lesson = await lessonWithCourse(lessonId, actor);
  const target = await db().courseModule.findUnique({ where: { id: targetModuleId } });
  if (!target || target.courseId !== lesson.module.courseId) throw new CourseError("Choose a module in the same course.");
  if (target.id === lesson.moduleId) return;
  const last = await db().lesson.findFirst({ where: { moduleId: target.id }, orderBy: { position: "desc" } });
  await db().lesson.update({ where: { id: lessonId }, data: { moduleId: target.id, position: (last?.position ?? -1) + 1 } });
  await changed(actor, lesson.module.courseId, "lesson moved");
}

export async function deleteLesson(lessonId: string, actor: Actor) {
  const lesson = await lessonWithCourse(lessonId, actor);
  await assertNoProgress([lessonId]);
  await db().lesson.delete({ where: { id: lessonId } });
  await changed(actor, lesson.module.courseId, "lesson deleted");
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export async function addResource(courseId: string, lessonId: string | null, input: z.infer<typeof resourceInput>, actor: Actor) {
  await requireCourse(courseId, actor);
  if (lessonId) {
    const lesson = await db().lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
    if (!lesson || lesson.module.courseId !== courseId) throw new CourseError("Lesson not found.", 404);
  }
  if (input.kind === "FILE") {
    const file = await db().mediaAsset.findFirst({ where: { id: input.mediaAssetId, ...mediaScope(actor) } });
    if (!file) throw new CourseError("Choose a file from your Media library.");
  }
  const last = await db().courseResource.findFirst({ where: { courseId, lessonId }, orderBy: { position: "desc" } });
  await db().courseResource.create({
    data: {
      courseId,
      lessonId,
      title: input.title,
      kind: input.kind,
      mediaAssetId: input.kind === "FILE" ? input.mediaAssetId : null,
      url: input.kind === "LINK" ? input.url : null,
      position: (last?.position ?? -1) + 1,
    },
  });
  await changed(actor, courseId, "resource added");
}

export async function deleteResource(resourceId: string, actor: Actor) {
  const res = await db().courseResource.findUnique({ where: { id: resourceId } });
  if (!res) throw new CourseError("Resource not found.", 404);
  await requireCourse(res.courseId, actor);
  await db().courseResource.delete({ where: { id: resourceId } });
  await changed(actor, res.courseId, "resource removed");
}

/** Media the user can attach to a course (thumbnail images and resource files). */
export function pickableMedia(actor: Actor) {
  return db().mediaAsset.findMany({
    where: mediaScope(actor),
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, originalName: true, mimeType: true, visibility: true, storageKey: true },
  });
}
