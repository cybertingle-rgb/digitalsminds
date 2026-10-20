"use server";

import { revalidatePath } from "next/cache";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createRateLimiter } from "@/lib/rate-limit";
import { getCurrentUser } from "@/modules/auth/session";
import { createTicket, messageInput, studentReply, SupportError, ticketInput } from "@/modules/support/service";

export type SupportState = { status: "idle" | "success" | "error"; message?: string; errors?: Record<string, string>; redirectTo?: string };

// Per account: plenty for real conversations, but stops flooding the team's inbox.
const newTickets = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
const replies = createRateLimiter({ limit: 30, windowMs: 60 * 60 * 1000 });

export async function createTicketAction(lang: string, _prev: SupportState, fd: FormData): Promise<SupportState> {
  const locale = hasLocale(lang) ? lang : "en";
  const dict = getDictionary(locale);
  const t = dict.support;
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: dict.auth.errors.generic };
  const parsed = ticketInput.safeParse({ subject: String(fd.get("subject") ?? ""), courseId: String(fd.get("courseId") ?? ""), message: String(fd.get("message") ?? "") });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0]);
      errors[k] = k === "subject" ? t.errors.subject : t.errors.message;
    }
    return { status: "error", errors };
  }
  if (!newTickets(user.id).allowed) return { status: "error", message: t.errors.tooMany };
  try {
    const ticket = await createTicket(user.id, parsed.data);
    revalidatePath(localizePath("/account/support", locale));
    return { status: "success", message: t.sent, redirectTo: localizePath(`/account/support/${ticket.id}`, locale) };
  } catch (e) {
    if (e instanceof SupportError) return { status: "error", message: dict.auth.errors.generic };
    throw e;
  }
}

export async function studentReplyAction(lang: string, ticketId: string, _prev: SupportState, fd: FormData): Promise<SupportState> {
  const locale = hasLocale(lang) ? lang : "en";
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: dict.auth.errors.generic };
  const body = messageInput.safeParse(String(fd.get("body") ?? ""));
  if (!body.success) return { status: "error", errors: { body: dict.support.errors.message } };
  if (!replies(user.id).allowed) return { status: "error", message: dict.support.errors.tooMany };
  try {
    await studentReply(String(ticketId).slice(0, 64), user.id, body.data);
  } catch (e) {
    if (e instanceof SupportError) return { status: "error", message: e.message === "closed" ? dict.support.closedNote : dict.auth.errors.generic };
    throw e;
  }
  revalidatePath(localizePath(`/account/support/${ticketId}`, locale));
  return { status: "success", message: dict.support.sent };
}
