"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/modules/audit/log";
import type { Permission } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError, type CurrentUser } from "@/modules/auth/session";
import { addNote, deleteInquiry, InquiryError, updateInput, updateInquiry } from "@/modules/inquiries/admin";
import { saveLeadAlertSetting } from "@/modules/inquiries/alerts";

export type LeadState = { status: "idle" | "success" | "error"; message?: string };

async function run(permission: Permission, fn: (actor: CurrentUser) => Promise<string>, paths: string[]): Promise<LeadState> {
  let actor;
  try {
    actor = await assertPermission(permission);
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: e.message };
    throw e;
  }
  try {
    const message = await fn(actor);
    for (const p of paths) revalidatePath(p);
    return { status: "success", message };
  } catch (e) {
    if (e instanceof InquiryError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) return { status: "error", message: "Please check the values and try again." };
    console.error("[inquiries] action failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

const id = z.string().min(1).max(64);

export async function updateInquiryAction(inquiryId: string, _prev: LeadState, formData: FormData): Promise<LeadState> {
  return run(
    "inquiries.manage",
    async (actor) => {
      const input = updateInput.parse({
        status: formData.get("status"),
        assignedToId: formData.get("assignedToId") || null,
        followUpDay: formData.get("followUpDay") || null,
      });
      await updateInquiry(id.parse(inquiryId), input, actor);
      return "Saved.";
    },
    ["/admin/inquiries", `/admin/inquiries/${inquiryId}`, "/admin"],
  );
}

export async function addNoteAction(inquiryId: string, _prev: LeadState, formData: FormData): Promise<LeadState> {
  return run(
    "inquiries.manage",
    async (actor) => {
      await addNote(id.parse(inquiryId), String(formData.get("body") ?? ""), actor);
      return "Note added.";
    },
    [`/admin/inquiries/${inquiryId}`],
  );
}

export async function deleteInquiryAction(inquiryId: string): Promise<LeadState> {
  return run(
    "inquiries.delete",
    async (actor) => {
      await deleteInquiry(id.parse(inquiryId), actor);
      return "Inquiry deleted.";
    },
    ["/admin/inquiries", "/admin"],
  );
}

export async function saveAlertSettingAction(_prev: LeadState, formData: FormData): Promise<LeadState> {
  return run(
    "settings.manage",
    async (actor) => {
      const value = z.object({ enabled: z.boolean(), email: z.email("Enter a valid email address") }).parse({
        enabled: formData.get("enabled") === "on",
        email: String(formData.get("email") ?? "").trim().toLowerCase(),
      });
      await saveLeadAlertSetting(value, actor.id);
      await audit({ actorId: actor.id, action: "settings.lead_alerts", entityType: "Setting", entityId: "notifications.inquiry", metadata: value });
      return value.enabled ? `New inquiries will be emailed to ${value.email}.` : "Lead alert emails are off.";
    },
    ["/admin/inquiries"],
  );
}
