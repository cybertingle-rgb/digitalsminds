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
import { canManageCourse, manageableCoursesWhere } from "@/modules/auth/scoping";
import type { CurrentUser } from "@/modules/auth/session";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";

export class AnnouncementError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AnnouncementError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

export const announcementInput = z.object({
  /** "" = all students (site-wide). */
  courseId: z.string().max(64).transform((v) => v || null),
  title: z.string().trim().min(3, "Enter a title").max(200),
  body: z.string().trim().min(5, "Write the announcement").max(10_000),
  sendEmail: z.boolean(),
});

/** Active students who should receive it: everyone, or those enrolled in the course. */
function recipientsWhere(courseId: string | null): Prisma.UserWhereInput {
  return courseId
    ? { status: "ACTIVE", enrollments: { some: { courseId, status: "APPROVED" } } }
    : { status: "ACTIVE", role: "STUDENT" };
}

async function assertCanAnnounce(courseId: string | null, actor: Actor) {
  if (courseId === null) {
    if (!can(actor.role, "announcements.site")) throw new AnnouncementError("Only Super Admins and Content Managers can message all students.", 403);
    return null;
  }
  const course = await db().course.findUnique({ where: { id: courseId }, select: { id: true, slug: true, status: true, title: true } });
  if (!course || !(await canManageCourse(actor, courseId))) throw new AnnouncementError("Course not found.", 404);
  if (course.status === "DRAFT") throw new AnnouncementError("Publish the course before sending announcements to its students.");
  return course;
}

export async function createAnnouncement(input: z.infer<typeof announcementInput>, actor: Actor) {
  const course = await assertCanAnnounce(input.courseId, actor);
  const announcement = await db().announcement.create({
    data: { courseId: input.courseId, title: input.title, body: input.body, authorId: actor.id, publishedAt: new Date() },
  });
  const recipients = await db().user.findMany({ where: recipientsWhere(input.courseId), select: { id: true } });
  await notify(
    recipients.map((r) => r.id),
    { type: "ANNOUNCEMENT", title: input.title, body: input.body.length > 300 ? `${input.body.slice(0, 300)}…` : input.body, link: course ? `/learn/${course.slug}` : "/account" },
  );
  await audit({
    actorId: actor.id,
    action: "announcement.created",
    entityType: "Announcement",
    entityId: announcement.id,
    metadata: { course: course?.title ?? "All students", recipients: recipients.length, email: input.sendEmail },
  });
  return { announcement, recipients: recipients.length };
}

/**
 * Emails an announcement to its recipients one by one (run after the response,
 * so the admin isn't kept waiting). Hostinger mailboxes have daily sending
 * limits, so failures are counted and logged rather than retried in a loop.
 */
export async function sendAnnouncementEmails(id: string) {
  const a = await db().announcement.findUnique({ where: { id }, include: { course: { select: { slug: true } } } });
  if (!a || a.emailSentAt) return { sent: 0, failed: 0 };
  // Claim it first so a double submit can't email everyone twice.
  const claimed = await db().announcement.updateMany({ where: { id, emailSentAt: null }, data: { emailSentAt: new Date() } });
  if (claimed.count === 0) return { sent: 0, failed: 0 };
  const users = await db().user.findMany({ where: recipientsWhere(a.courseId), select: { email: true, name: true, preferredLocale: true } });
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
          url: `${siteConfig.url}${localizePath(a.course ? `/learn/${a.course.slug}` : "/account", locale)}`,
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

export async function deleteAnnouncement(id: string, actor: Actor) {
  const a = await db().announcement.findUnique({ where: { id } });
  if (!a) throw new AnnouncementError("Announcement not found.", 404);
  await assertCanAnnounce(a.courseId, actor).catch((e) => {
    // A course moved back to draft can still have its old announcements removed.
    if (e instanceof AnnouncementError && e.status === 400) return null;
    throw e;
  });
  await db().announcement.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "announcement.deleted", entityType: "Announcement", entityId: id, metadata: { title: a.title } });
}

/** Announcements this staff member can see and manage. */
export function adminAnnouncements(actor: Actor) {
  const scope: Prisma.AnnouncementWhereInput[] = [{ course: manageableCoursesWhere(actor) }];
  if (can(actor.role, "announcements.site")) scope.push({ courseId: null });
  return db().announcement.findMany({
    where: { OR: scope },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { course: { select: { title: true } }, author: { select: { name: true } } },
  });
}

/** Latest announcements for a student: site-wide plus their enrolled courses. */
export function studentAnnouncements(userId: string, take = 5) {
  return db().announcement.findMany({
    where: {
      publishedAt: { not: null },
      OR: [{ courseId: null }, { course: { enrollments: { some: { userId, status: "APPROVED" } }, status: { in: ["PUBLISHED", "ARCHIVED"] } } }],
    },
    orderBy: { publishedAt: "desc" },
    take,
    include: { course: { select: { title: true, titleUr: true, slug: true } } },
  });
}

export function courseAnnouncements(courseId: string, take = 3) {
  return db().announcement.findMany({ where: { courseId, publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, take });
}
