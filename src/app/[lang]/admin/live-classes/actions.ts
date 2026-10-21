"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { cancelLiveClass, createLiveClass, liveClassInput, LiveClassError, updateLiveClass } from "@/modules/live/service";

export type LiveState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

async function run(fn: (actor: CurrentUser) => Promise<string>, refresh = true): Promise<LiveState> {
  try {
    const actor = await assertPermission("admin.access");
    if (!can(actor.role, "courses.manage.all") && !can(actor.role, "courses.manage.own")) throw new ForbiddenError();
    const message = await fn(actor);
    // Cancelling keeps its confirmation on screen (the page shows the change on the next visit).
    if (refresh) revalidatePath("/admin/live-classes");
    return { status: "success", message };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof LiveClassError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted fields.", errors };
    }
    console.error("[live] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const read = (fd: FormData) =>
  liveClassInput.parse({
    courseId: String(fd.get("courseId") ?? ""),
    title: String(fd.get("title") ?? ""),
    description: String(fd.get("description") ?? ""),
    date: String(fd.get("date") ?? ""),
    time: String(fd.get("time") ?? ""),
    durationMinutes: String(fd.get("durationMinutes") ?? ""),
    meetingUrl: String(fd.get("meetingUrl") ?? ""),
  });

export async function createLiveAction(_prev: LiveState, fd: FormData): Promise<LiveState> {
  return run(async (actor) => {
    await createLiveClass(read(fd), actor);
    return "Class scheduled. Enrolled students can see it now and get reminders 1 day and 1 hour before.";
  });
}

export async function updateLiveAction(id: string, _prev: LiveState, fd: FormData): Promise<LiveState> {
  return run(async (actor) => {
    await updateLiveClass(z.string().min(1).max(64).parse(id), read(fd), actor);
    return "Saved. If the time changed, students have been told.";
  });
}

export async function cancelLiveAction(id: string): Promise<LiveState> {
  return run(async (actor) => {
    await cancelLiveClass(z.string().min(1).max(64).parse(id), actor);
    return "Class cancelled. Students have been told.";
  }, false);
}
