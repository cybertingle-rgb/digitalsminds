import "server-only";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import type { Prisma } from "@/generated/prisma/client";
import { localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { idsContaining } from "@/lib/text-search";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { actionEmail } from "@/modules/email/templates";
import { getLeadAlertSetting } from "@/modules/inquiries/alerts";
import { notify } from "@/modules/notifications/service";

export class SupportError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "SupportError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
export type TicketStatus = "OPEN" | "AWAITING_STUDENT" | "RESOLVED" | "CLOSED";
export const ticketStatuses: TicketStatus[] = ["OPEN", "AWAITING_STUDENT", "RESOLVED", "CLOSED"];

export const ticketInput = z.object({
  subject: z.string().trim().min(3).max(200),
  courseId: z.string().max(64).transform((v) => v || null),
  message: z.string().trim().min(1).max(10_000),
});
export const messageInput = z.string().trim().min(1).max(10_000);

const excerpt = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/** Courses a student can pick when opening a ticket (any course they have requested or joined). */
export function ticketCourses(userId: string) {
  return db().course.findMany({ where: { enrollments: { some: { userId } } }, orderBy: { title: "asc" }, select: { id: true, title: true, titleUr: true } });
}

export async function createTicket(userId: string, input: z.infer<typeof ticketInput>) {
  if (input.courseId) {
    const linked = await db().enrollment.findFirst({ where: { userId, courseId: input.courseId }, select: { id: true } });
    if (!linked) throw new SupportError("course");
  }
  const ticket = await db().supportTicket.create({
    data: { userId, courseId: input.courseId, subject: input.subject, messages: { create: { authorId: userId, body: input.message } } },
  });
  await alertTeam(ticket.id, "new");
  return ticket;
}

export function studentTickets(userId: string) {
  return db().supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { course: { select: { title: true, titleUr: true } }, _count: { select: { messages: { where: { internal: false } } } } },
  });
}

/** A student's own ticket, without staff-only notes. */
export function studentTicket(id: string, userId: string) {
  return db().supportTicket.findFirst({
    where: { id, userId },
    include: {
      course: { select: { title: true, titleUr: true } },
      messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
    },
  });
}

export async function studentReply(id: string, userId: string, body: string) {
  const ticket = await db().supportTicket.findFirst({ where: { id, userId } });
  if (!ticket) throw new SupportError("notFound", 404);
  if (ticket.status === "CLOSED") throw new SupportError("closed");
  await db().$transaction([
    db().supportMessage.create({ data: { ticketId: id, authorId: userId, body } }),
    db().supportTicket.update({ where: { id }, data: { status: "OPEN", closedAt: null } }),
  ]);
  await alertTeam(id, "reply");
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/** Super Admin / Content Manager: every ticket. Batch coordinators: tickets from their batches' students. */
export function supportScope(actor: Actor): Prisma.SupportTicketWhereInput {
  if (can(actor.role, "support.manage.all")) return {};
  // Coordinators: tickets from students in the batches they coordinate.
  if (can(actor.role, "support.manage.own")) return { user: { enrollments: { some: { batch: { coordinatorId: actor.id } } } } };
  return { id: "__none__" };
}

export type TicketFilter = { status?: TicketStatus | "ACTIVE"; q?: string; courseId?: string };

export function parseTicketFilter(sp: Record<string, string | string[] | undefined>): TicketFilter {
  const one = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const status = sp.status === "ALL" ? undefined : ([...ticketStatuses, "ACTIVE"] as const).find((s) => s === sp.status) ?? "ACTIVE";
  return { status, q: one(sp.q).slice(0, 100) || undefined, courseId: one(sp.course).slice(0, 64) || undefined };
}

export async function listTickets(actor: Actor, f: TicketFilter, page: number, pageSize: number) {
  const where: Prisma.SupportTicketWhereInput = {
    AND: [
      supportScope(actor),
      f.status === "ACTIVE" ? { status: { in: ["OPEN", "AWAITING_STUDENT"] } } : f.status ? { status: f.status } : {},
      f.courseId ? { courseId: f.courseId } : {},
      f.q ? { OR: [{ id: { in: await idsContaining("SupportTicket", ["subject"], f.q) } }, { userId: { in: await idsContaining("User", ["name", "email"], f.q) } }] } : {},
    ],
  };
  const [items, total, open] = await Promise.all([
    db().supportTicket.findMany({
      where,
      // Open tickets that have waited longest first.
      orderBy: f.status === "ACTIVE" || f.status === "OPEN" ? [{ status: "asc" }, { updatedAt: "asc" }] : { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, authorId: true } },
      },
    }),
    db().supportTicket.count({ where }),
    db().supportTicket.count({ where: { AND: [supportScope(actor), { status: "OPEN" }] } }),
  ]);
  return { items, total, open };
}

export function openTicketCount(actor: Actor) {
  return db().supportTicket.count({ where: { AND: [supportScope(actor), { status: "OPEN" }] } });
}

export function staffTicket(id: string, actor: Actor) {
  return db().supportTicket.findFirst({
    where: { AND: [{ id }, supportScope(actor)] },
    include: {
      user: { select: { id: true, name: true, email: true, googleEmail: true, role: true } },
      course: { select: { id: true, title: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } },
    },
  });
}

export async function staffReply(id: string, body: string, internal: boolean, actor: Actor) {
  const ticket = await staffTicket(id, actor);
  if (!ticket) throw new SupportError("Ticket not found.", 404);
  if (ticket.status === "CLOSED" && !internal) throw new SupportError("Reopen the ticket before replying to the student.");
  await db().$transaction([
    db().supportMessage.create({ data: { ticketId: id, authorId: actor.id, body, internal } }),
    // A public reply hands the ticket back to the student.
    ...(internal ? [] : [db().supportTicket.update({ where: { id }, data: { status: "AWAITING_STUDENT" } })]),
  ]);
  await audit({ actorId: actor.id, action: internal ? "support.note" : "support.reply", entityType: "SupportTicket", entityId: id });
  if (!internal) await tellStudent(id, body);
}

export async function setTicketStatus(id: string, status: TicketStatus, actor: Actor) {
  const ticket = await staffTicket(id, actor);
  if (!ticket) throw new SupportError("Ticket not found.", 404);
  if (ticket.status === status) return;
  await db().supportTicket.update({
    where: { id },
    data: { status, closedAt: status === "CLOSED" || status === "RESOLVED" ? new Date() : null },
  });
  await audit({ actorId: actor.id, action: "support.status", entityType: "SupportTicket", entityId: id, metadata: { from: ticket.status, to: status } });
}

// ---------------------------------------------------------------------------
// Emails and notifications (best effort)
// ---------------------------------------------------------------------------

/** New ticket or student reply: email the lead-alert address and the student's batch coordinators. */
async function alertTeam(ticketId: string, kind: "new" | "reply") {
  try {
    const t = await db().supportTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        user: { select: { name: true, email: true, enrollments: { where: { batch: { coordinator: { status: "ACTIVE" } } }, select: { batch: { select: { coordinator: { select: { email: true } } } } } } } },
        course: { select: { title: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    });
    const setting = await getLeadAlertSetting();
    const coordinators = t.user.enrollments.flatMap((e) => (e.batch?.coordinator ? [e.batch.coordinator.email] : []));
    const to = [...new Set([...(setting.enabled ? [setting.email] : []), ...coordinators])];
    if (to.length === 0) return;
    const dict = getDictionary("en");
    const about = t.course ? ` about “${t.course.title}”` : "";
    for (const address of to) {
      await sendMail(
        actionEmail({
          dict,
          locale: "en",
          to: address,
          name: "Digitals Minds team",
          subject: kind === "new" ? `Support request: ${t.subject}` : `New reply on support request: ${t.subject}`,
          intro: `${t.user.name} (${t.user.email}) ${kind === "new" ? "opened a support request" : "replied"}${about}: “${excerpt(t.messages[0]?.body ?? "")}”`,
          buttonLabel: "Open the ticket",
          url: `${siteConfig.url}/admin/support/${t.id}`,
          ignoreNote: false,
        }),
      );
    }
  } catch (err) {
    console.warn("[support] team alert not sent:", err instanceof Error ? err.message : err);
  }
}

async function tellStudent(ticketId: string, body: string) {
  try {
    const t = await db().supportTicket.findUniqueOrThrow({ where: { id: ticketId }, include: { user: true } });
    const locale: Locale = t.user.preferredLocale === "ur" ? "ur" : "en";
    const dict = getDictionary(locale);
    const link = `/account/support/${t.id}`;
    await notify(t.userId, { type: "SUPPORT_REPLY", title: format(dict.notifications.supportReply, { subject: t.subject }), body: excerpt(body, 300), link });
    await sendMail(
      actionEmail({
        dict,
        locale,
        to: t.user.email,
        name: t.user.name,
        subject: format(dict.emails.supportReplySubject, { subject: t.subject }),
        intro: format(dict.emails.supportReplyIntro, { subject: t.subject, excerpt: excerpt(body) }),
        buttonLabel: dict.emails.supportReplyButton,
        url: `${siteConfig.url}${localizePath(link, locale)}`,
        ignoreNote: false,
      }),
    );
  } catch (err) {
    console.warn("[support] student email not sent:", err instanceof Error ? err.message : err);
  }
}
