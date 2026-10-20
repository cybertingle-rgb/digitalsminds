"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/modules/audit/log";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { deleteSubscriber } from "@/modules/newsletter/service";

/** Permanently removes an address (privacy requests). Super Admin only. */
export async function deleteSubscriberAction(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const actor = await assertPermission("newsletter.delete");
    await deleteSubscriber(z.string().min(1).max(64).parse(id));
    await audit({ actorId: actor.id, action: "newsletter.deleted", entityType: "NewsletterSubscriber", entityId: id });
    revalidatePath("/admin/newsletter");
    return { ok: true, message: "Removed." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    console.error("[newsletter] delete failed", e);
    return { ok: false, message: "Could not remove it." };
  }
}
