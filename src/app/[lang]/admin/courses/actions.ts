"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { courseDetailsInput, lessonInput, moduleInput, newCourseInput, resourceInput } from "@/modules/courses/schema";
import * as courses from "@/modules/courses/service";
import { PaymentError, priceInput, setCoursePrice } from "@/modules/payments/service";

export type CourseState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string>;
  /** Where the client should go next (e.g. a newly created course). */
  redirectTo?: string;
};

async function run(fn: (actor: CurrentUser) => Promise<Omit<CourseState, "status"> | string>): Promise<CourseState> {
  let actor;
  try {
    actor = await assertPermission("admin.access");
    if (!can(actor.role, "courses.manage.all") && !can(actor.role, "courses.manage.own")) throw new ForbiddenError();
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: e.message };
    throw e;
  }
  try {
    const result = await fn(actor);
    revalidatePath("/admin/courses", "layout");
    return { status: "success", ...(typeof result === "string" ? { message: result } : result) };
  } catch (e) {
    if (e instanceof courses.CourseError || e instanceof PaymentError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !errors[key]) errors[key] = issue.message;
      }
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[courses] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const id = z.string().min(1).max(64);
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

// --- Courses ---------------------------------------------------------------

export async function createCourseAction(_prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const course = await courses.createCourse(
      newCourseInput.parse({ title: str(fd, "title"), language: str(fd, "language"), summary: str(fd, "summary") }),
      actor,
    );
    return { message: "Program created.", redirectTo: `/admin/courses/${course.id}` };
  });
}

export async function saveDetailsAction(courseId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const input = courseDetailsInput.parse({
      title: str(fd, "title"),
      titleUr: str(fd, "titleUr"),
      slug: str(fd, "slug"),
      language: str(fd, "language"),
      summary: str(fd, "summary"),
      summaryUr: str(fd, "summaryUr"),
      description: str(fd, "description"),
      objectives: str(fd, "objectives"),
      prerequisites: str(fd, "prerequisites"),
      level: str(fd, "level"),
      durationText: str(fd, "durationText"),
      format: str(fd, "format"),
      thumbnailId: str(fd, "thumbnailId"),
      serviceSlug: str(fd, "serviceSlug"),
      certificateEnabled: fd.get("certificateEnabled") === "on",
      seoTitle: str(fd, "seoTitle"),
      seoDescription: str(fd, "seoDescription"),
    });
    await courses.updateCourseDetails(id.parse(courseId), input, actor);
    return "Program details saved.";
  });
}

export async function setInstructorsAction(courseId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const ids = z.array(id).max(50).parse(fd.getAll("instructorIds").map(String));
    await courses.setInstructors(id.parse(courseId), ids, actor);
    return "Instructors updated.";
  });
}

export async function setPriceAction(courseId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const input = priceInput.parse({ paid: fd.get("access") === "PAID", pricePkr: str(fd, "pricePkr") });
    await setCoursePrice(id.parse(courseId), input, actor);
    revalidatePath("/[lang]", "layout");
    return input.paid ? "Price saved. Students now pay to join." : "This course is free again.";
  });
}

export async function setStatusAction(courseId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<CourseState> {
  return run(async (actor) => {
    const next = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(status);
    await courses.setCourseStatus(id.parse(courseId), next, actor);
    return { DRAFT: "Moved back to draft. Students can no longer find it.", PUBLISHED: "Published.", ARCHIVED: "Archived." }[next];
  });
}

export async function deleteCourseAction(courseId: string): Promise<CourseState> {
  return run(async (actor) => {
    await courses.deleteCourse(id.parse(courseId), actor);
    return { message: "Course deleted.", redirectTo: "/admin/courses" };
  });
}

// --- Modules ---------------------------------------------------------------

export async function addModuleAction(courseId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    await courses.addModule(id.parse(courseId), moduleInput.parse({ title: str(fd, "title") }), actor);
    return "Module added.";
  });
}

export async function renameModuleAction(moduleId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    await courses.renameModule(id.parse(moduleId), moduleInput.parse({ title: str(fd, "title") }), actor);
    return "Module renamed.";
  });
}

export async function deleteModuleAction(moduleId: string): Promise<CourseState> {
  return run(async (actor) => {
    await courses.deleteModule(id.parse(moduleId), actor);
    return "Module deleted.";
  });
}

export async function moveModuleAction(moduleId: string, direction: "up" | "down"): Promise<CourseState> {
  return run(async (actor) => {
    await courses.moveModule(id.parse(moduleId), z.enum(["up", "down"]).parse(direction), actor);
    return "Moved.";
  });
}

// --- Lessons ---------------------------------------------------------------

export async function addLessonAction(moduleId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const title = z.object({ title: z.string().trim().min(2, "Enter a lesson title").max(200) }).parse({ title: str(fd, "title") }).title;
    await courses.addLesson(id.parse(moduleId), title, actor);
    return "Lesson added.";
  });
}

export async function saveLessonAction(lessonId: string, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const input = lessonInput.parse({
      title: str(fd, "title"),
      content: str(fd, "content"),
      videoUrl: str(fd, "videoUrl"),
      durationMinutes: str(fd, "durationMinutes"),
      isPreview: fd.get("isPreview") === "on",
    });
    await courses.updateLesson(id.parse(lessonId), input, actor);
    return "Lesson saved.";
  });
}

export async function moveLessonAction(lessonId: string, direction: "up" | "down"): Promise<CourseState> {
  return run(async (actor) => {
    await courses.moveLesson(id.parse(lessonId), z.enum(["up", "down"]).parse(direction), actor);
    return "Moved.";
  });
}

export async function moveLessonToModuleAction(lessonId: string, moduleId: string): Promise<CourseState> {
  return run(async (actor) => {
    await courses.moveLessonToModule(id.parse(lessonId), id.parse(moduleId), actor);
    return "Lesson moved.";
  });
}

export async function deleteLessonAction(lessonId: string): Promise<CourseState> {
  return run(async (actor) => {
    await courses.deleteLesson(id.parse(lessonId), actor);
    return "Lesson deleted.";
  });
}

// --- Resources -------------------------------------------------------------

export async function addResourceAction(courseId: string, lessonId: string | null, _prev: CourseState, fd: FormData): Promise<CourseState> {
  return run(async (actor) => {
    const input = resourceInput.parse({
      kind: str(fd, "kind"),
      title: str(fd, "title"),
      ...(str(fd, "kind") === "FILE" ? { mediaAssetId: str(fd, "mediaAssetId") } : { url: str(fd, "url").trim() }),
    });
    await courses.addResource(id.parse(courseId), lessonId ? id.parse(lessonId) : null, input, actor);
    return "Resource added.";
  });
}

export async function deleteResourceAction(resourceId: string): Promise<CourseState> {
  return run(async (actor) => {
    await courses.deleteResource(id.parse(resourceId), actor);
    return "Resource removed.";
  });
}
