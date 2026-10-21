import "server-only";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import type { Prisma } from "@/generated/prisma/client";
import { localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { canCoordinate } from "@/modules/batches/service";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";
import { ACTIVE_STAGES } from "@/modules/portal/service";

/**
 * Notices for students: everyone, one program's students, or one batch's.
 * They appear in the student portal and notifications, and can be emailed.
 */

export class AnnouncementError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AnnouncementError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

/** "all", "course:<id>" or "batch:<id>". */
const audience = z.string().regex(/^(all|course:[\w-]{1,64}|batch:[\w-]{1,64})$/, "Choose who it's for");

export const announcementInput = z.object({
  audience,
  title: z.string().trim().min(3, "Enter a title").max(200),
  body: z.string().trim().min(5, "Write the announcement").max(10_000),
  sendEmail: z.boolean(),
});

type Target = { courseId: string | null; batchId: string | null };

function parseAudience(value: string): Target & { kind: "all" | "course" | "batch" } {
  if (value === "all") return { kind: "all", courseId: null, batchId: null };
  const [kind, id] = value.split(":") as ["course" | "batch", string];
  return kind === "course" ? { kind, courseId: id, batchId: null } : { kind, courseId: null, batchId: id };
}

/** Current students who should receive it. */
function recipientsWhere(t: Target): Prisma.UserWhereInput {
  const current = { stage: { in: [...ACTIVE_STAGES] } };
  if (t.batchId) return { status: "ACTIVE", enrollments: { some: { batchId: t.batchId, ...current } } };
  if (t.courseId) return { status: "ACTIVE", enrollments: { some: { courseId: t.courseId, OR: [current, { stage: null, status: "APPROVED" }] } } };
  return { status: "ACTIVE", role: "STUDENT", enrollments: { some: { OR: [current, { stage: null, status: "APPROVED" }] } } };
}

/** Checks permission and returns where the announcement belongs (a batch's program is stored too). */
async function resolveTarget(value: string, actor: Actor): Promise<Target & { label: string }> {
  const t = parseAudience(value);
  if (t.kind === "all") {
    if (!can(actor.role, "announcements.site")) throw new AnnouncementError("Only Super Admins and Content Managers can message all students.", 403);
    return { ...t, label: "All students" };
  }
  if (t.kind === "course") {
    if (!can(actor.role, "courses.manage.all")) throw new AnnouncementError("Only Super Admins and Content Managers can message a whole program.", 403);
    const course = await db().course.findUnique({ where: { id: t.courseId! }, select: { title: true, status: true } });
    if (!course) throw new AnnouncementError("Program not found.", 404);
    return { ...t, label: course.title };
  }
  const batch = await db().batch.findUnique({ where: { id: t.batchId! }, select: { courseId: true, name: true } });
  if (!batch || !(await canCoordinate(actor, t.batchId!))) throw new AnnouncementError("Batch not found.", 404);
  return { courseId: batch.courseId, batchId: t.batchId, label: batch.name };
}

export async function createAnnouncement(input: z.infer<typeof announcementInput>, actor: Actor) {
  const target = await resolveTarget(input.audience, actor);
  const announcement = await db().announcement.create({
    data: { courseId: target.courseId, batchId: target.batchId, title: input.title, body: input.body, authorId: actor.id, publishedAt: new Date() },
  });
  const recipients = await db().user.findMany({ where: recipientsWhere(target), select: { id: true } });
  await notify(
    recipients.map((r) => r.id),
    { type: "ANNOUNCEMENT", title: input.title, body: input.body.length > 300 ? `${input.body.slice(0, 300)}…` : input.body, link: "/account/notices" },
  );
  await audit({
    actorId: actor.id,
    action: "announcement.created",
    entityType: "Announcement",
    entityId: announcement.id,
    metadata: { to: target.label, recipients: recipients.length, email: input.sendEmail },
  });
  return { announcement, recipients: recipients.length };
}

/**
 * Emails an announcement to its recipients one by one (run after the response,
 * so the admin isn't kept waiting). Hostinger mailboxes have daily sending
 * limits, so failures are counted and logged rather than retried in a loop.
 */
export async function sendAnnouncementEmails(id: string) {
  const a = await db().announcement.findUnique({ where: { id } });
  if (!a || a.emailSentAt) return { sent: 0, failed: 0 };
  // Claim it first so a double submit can't email everyone twice.
  const claimed = await db().announcement.updateMany({ where: { id, emailSentAt: null }, data: { emailSentAt: new Date() } });
  if (claimed.count === 0) return { sent: 0, failed: 0 };
  const users = await db().user.findMany({ where: recipientsWhere(a), select: { email: true, name: true, preferredLocale: true } });
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    const locale: Locale = u.preferredLocale === "ur" ? "ur" : "en";
    const dict = getDictionary(locale);
    try {
      await sendMail(
        actionEmail({
          dict,
          locale,
          to: u.email,
          name: u.name,
          subject: a.title,
          intro: a.body,
          buttonLabel: dict.announcements.emailButton,
          url: `${siteConfig.url}${localizePath("/account/notices", locale)}`,
          ignoreNote: false,
        }),
      );
      sent++;
    } catch (err) {
      failed++;
      if (failed <= 3) console.warn("[announcements] email failed:", err instanceof Error ? err.message : err);
    }
  }
  if (failed) console.warn(`[announcements] ${id}: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

async function assertCanManage(a: { courseId: string | null; batchId: string | null }, actor: Actor) {
  const ok = a.batchId ? await canCoordinate(actor, a.batchId) : a.courseId ? can(actor.role, "courses.manage.all") : can(actor.role, "announcements.site");
  if (!ok) throw new AnnouncementError("Announcement not found.", 404);
}

export async function deleteAnnouncement(id: string, actor: Actor) {
  const a = await db().announcement.findUnique({ where: { id } });
  if (!a) throw new AnnouncementError("Announcement not found.", 404);
  await assertCanManage(a, actor);
  await db().announcement.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "announcement.deleted", entityType: "Announcement", entityId: id, metadata: { title: a.title } });
}

/** Announcements this staff member can see and manage. */
export function adminAnnouncements(actor: Actor) {
  const scope: Prisma.AnnouncementWhereInput[] = [];
  if (can(actor.role, "announcements.site")) scope.push({ courseId: null, batchId: null });
  if (can(actor.role, "courses.manage.all")) scope.push({ courseId: { not: null } });
  else if (can(actor.role, "batches.coordinate")) scope.push({ batch: { coordinatorId: actor.id } });
  if (!scope.length) return Promise.resolve([]);
  return db().announcement.findMany({
    where: { OR: scope },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { course: { select: { title: true } }, batch: { select: { name: true } }, author: { select: { name: true } } },
  });
}

/** Who a staff member can send announcements to. */
export async function audienceOptions(actor: Actor) {
  const programs = can(actor.role, "courses.manage.all")
    ? await db().course.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { title: "asc" }, select: { id: true, title: true } })
    : [];
  const batches = await db().batch.findMany({
    where: { status: { notIn: ["DRAFT", "CANCELLED"] }, ...(can(actor.role, "batches.manage") ? {} : { coordinatorId: actor.id }) },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, code: true },
  });
  return [
    ...(can(actor.role, "announcements.site") ? [{ value: "all", label: "All current students" }] : []),
    ...programs.map((c) => ({ value: `course:${c.id}`, label: `Program: ${c.title}` })),
    ...batches.map((b) => ({ value: `batch:${b.id}`, label: `Batch: ${b.name} (${b.code})` })),
  ];
}
