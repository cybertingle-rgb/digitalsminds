"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { can } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { AnnouncementError, announcementInput, createAnnouncement, deleteAnnouncement, sendAnnouncementEmails } from "@/modules/announcements/service";

export type AnnouncementState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

async function staff() {
  const actor = await assertPermission("admin.access");
  if (!can(actor.role, "announcements.site") && !can(actor.role, "batches.manage") && !can(actor.role, "batches.coordinate")) throw new ForbiddenError();
  return actor;
}

function failure(e: unknown): AnnouncementState {
  if (e instanceof ForbiddenError || e instanceof AnnouncementError) return { status: "error", message: e.message };
  if (e instanceof z.ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
    return { status: "error", message: "Please check the highlighted fields.", errors };
  }
  console.error("[announcements] action failed", e);
  return { status: "error", message: "Something went wrong. Please try again." };
}

export async function createAnnouncementAction(_prev: AnnouncementState, fd: FormData): Promise<AnnouncementState> {
  try {
    const actor = await staff();
    const input = announcementInput.parse({
      audience: String(fd.get("audience") ?? ""),
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      sendEmail: fd.get("sendEmail") === "on",
    });
    const { announcement, recipients } = await createAnnouncement(input, actor);
    if (input.sendEmail && recipients > 0) after(() => sendAnnouncementEmails(announcement.id));
    revalidatePath("/admin/announcements");
    const who = `${recipients} ${recipients === 1 ? "student" : "students"}`;
    return { status: "success", message: input.sendEmail && recipients > 0 ? `Posted to ${who}. Emails are being sent now.` : `Posted to ${who}.` };
  } catch (e) {
    return failure(e);
  }
}

export async function deleteAnnouncementAction(id: string): Promise<AnnouncementState> {
  try {
    const actor = await staff();
    await deleteAnnouncement(z.string().min(1).max(64).parse(id), actor);
    revalidatePath("/admin/announcements");
    return { status: "success", message: "Announcement deleted." };
  } catch (e) {
    return failure(e);
  }
}
