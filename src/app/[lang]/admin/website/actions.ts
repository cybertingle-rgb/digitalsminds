"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/modules/audit/log";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { saveSocialLinks, socialInput } from "@/modules/settings/social";

export type WebsiteState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string> };

export async function saveSocialAction(_prev: WebsiteState, fd: FormData): Promise<WebsiteState> {
  try {
    const actor = await assertPermission("content.manage");
    const value = socialInput.parse({
      facebook: String(fd.get("facebook") ?? ""),
      instagram: String(fd.get("instagram") ?? ""),
      linkedin: String(fd.get("linkedin") ?? ""),
    });
    await saveSocialLinks(value, actor.id);
    await audit({ actorId: actor.id, action: "settings.social", entityType: "Setting", entityId: "site.social", metadata: value });
    revalidatePath("/admin/website");
    return { status: "success", message: "Saved. The icons update on the website within a few minutes." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { status: "error", message: e.message };
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
      return { status: "error", message: "Please check the highlighted links.", errors };
    }
    console.error("[website] save failed", e);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
