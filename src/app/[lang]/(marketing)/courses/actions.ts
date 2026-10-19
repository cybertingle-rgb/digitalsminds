"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentUser } from "@/modules/auth/session";
import { EnrollmentError, requestEnrollment, requestInput } from "@/modules/learning/enrollment";
import { setLessonComplete } from "@/modules/learning/progress";

export type RequestState = { status: "idle" | "success" | "error"; message?: string; fieldError?: string };

export async function requestAccessAction(lang: string, courseId: string, _prev: RequestState, fd: FormData): Promise<RequestState> {
  const locale = hasLocale(lang) ? lang : "en";
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: dict.courses.loginToRequest };
  const parsed = requestInput.safeParse({ googleEmail: String(fd.get("googleEmail") ?? ""), note: String(fd.get("note") ?? "") });
  if (!parsed.success) return { status: "error", fieldError: dict.auth.errors.googleEmail };
  try {
    await requestEnrollment(user, z.string().min(1).max(64).parse(courseId), parsed.data);
  } catch (e) {
    if (e instanceof EnrollmentError && e.message in dict.courses) {
      return { status: "error", message: dict.courses[e.message as "notAvailable" | "alreadyRequested" | "alreadyEnrolled"] };
    }
    console.error("[enrollment] request failed", e);
    return { status: "error", message: dict.auth.errors.generic };
  }
  revalidatePath(localizePath("/account", locale));
  return { status: "success", message: dict.courses.requestSent };
}

export async function setCompleteAction(slug: string, lessonId: string, done: boolean) {
  const user = await getCurrentUser();
  if (!user) return null;
  const ids = z.object({ slug: z.string().max(191), lessonId: z.string().max(64) }).safeParse({ slug, lessonId });
  if (!ids.success) return null;
  return setLessonComplete(user, ids.data.slug, ids.data.lessonId, done === true);
}
