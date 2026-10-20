"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/modules/auth/permissions";
import { assertPermission, ForbiddenError } from "@/modules/auth/session";
import { messageInput, setTicketStatus, staffReply, SupportError } from "@/modules/support/service";

export type TicketState = { status: "idle" | "success" | "error"; message?: string };

async function staff() {
  const actor = await assertPermission("admin.access");
  if (!can(actor.role, "support.manage.all") && !can(actor.role, "support.manage.own")) throw new ForbiddenError();
  return actor;
}

function failure(e: unknown): TicketState {
  if (e instanceof ForbiddenError || e instanceof SupportError) return { status: "error", message: e.message };
  if (e instanceof z.ZodError) return { status: "error", message: "Write a message first." };
  console.error("[support] action failed", e);
  return { status: "error", message: "Something went wrong. Please try again." };
}

export async function staffReplyAction(ticketId: string, _prev: TicketState, fd: FormData): Promise<TicketState> {
  try {
    const actor = await staff();
    const internal = fd.get("internal") === "on";
    await staffReply(z.string().max(64).parse(ticketId), messageInput.parse(String(fd.get("body") ?? "")), internal, actor);
    revalidatePath(`/admin/support/${ticketId}`);
    return { status: "success", message: internal ? "Internal note added (not visible to the student)." : "Reply sent. The student has been notified by email." };
  } catch (e) {
    return failure(e);
  }
}

export async function setStatusAction(ticketId: string, status: string): Promise<TicketState> {
  try {
    const actor = await staff();
    await setTicketStatus(z.string().max(64).parse(ticketId), z.enum(["OPEN", "AWAITING_STUDENT", "RESOLVED", "CLOSED"]).parse(status), actor);
    revalidatePath(`/admin/support/${ticketId}`);
    return { status: "success", message: "Status updated." };
  } catch (e) {
    return failure(e);
  }
}
