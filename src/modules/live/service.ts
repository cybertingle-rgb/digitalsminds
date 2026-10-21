import "server-only";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import type { Prisma } from "@/generated/prisma/client";
import { localeMeta, localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import { canManageCourse, manageableCoursesWhere } from "@/modules/auth/scoping";
import type { CurrentUser } from "@/modules/auth/session";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";

/**
 * Live classes: Zoom / Google Meet / Teams sessions for a course. Course staff
 * schedule them; approved students see them in their portal and get reminders
 * 1 day and 1 hour before. Times are entered and shown in Pakistan time (UTC+5,
 * no daylight saving) and stored in UTC.
 */

export class LiveClassError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "LiveClassError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
const PK_OFFSET = "+05:00";
const LEARNABLE = ["PUBLISHED", "ARCHIVED"] as const;

const MEETING_HOSTS = /^(([a-z0-9-]+\.)*zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)$/;

export const liveClassInput = z
  .object({
    courseId: z.string().min(1, "Choose a course").max(64),
    title: z.string().trim().min(3, "Enter a title").max(200),
    description: z.string().trim().max(5000).optional().transform((v) => v || null),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time"),
    durationMinutes: z.coerce.number().int("Whole minutes").min(15, "At least 15 minutes").max(600, "At most 10 hours"),
    meetingUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => {
        try {
          const u = new URL(v);
          return u.protocol === "https:" && MEETING_HOSTS.test(u.hostname.toLowerCase());
        } catch {
          return false;
        }
      }, "Paste the full https:// Zoom, Google Meet or Teams link"),
  })
  .transform((v) => ({ ...v, startsAt: new Date(`${v.date}T${v.time}:00${PK_OFFSET}`) }));
export type LiveClassInput = z.infer<typeof liveClassInput>;

/** Date and time parts in Pakistan time, for edit forms. */
export function pkParts(d: Date) {
  const pk = new Date(d.getTime() + 5 * 3600_000).toISOString();
  return { date: pk.slice(0, 10), time: pk.slice(11, 16) };
}

export const endsAt = (c: { startsAt: Date; durationMinutes: number }) => new Date(c.startsAt.getTime() + c.durationMinutes * 60_000);

async function assertCanManage(actor: Actor, courseId: string) {
  if (!(await canManageCourse(actor, courseId))) throw new LiveClassError("You can only schedule classes for courses you manage.", 403);
}

async function approvedStudents(courseId: string) {
  return db().user.findMany({
    where: { status: "ACTIVE", enrollments: { some: { courseId, status: "APPROVED" } } },
    select: { id: true, email: true, name: true, preferredLocale: true },
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function createLiveClass(input: LiveClassInput, actor: Actor) {
  await assertCanManage(actor, input.courseId);
  if (input.startsAt.getTime() <= Date.now()) throw new z.ZodError([{ code: "custom", path: ["date"], message: "Choose a time in the future", input: input.date }]);
  const course = await db().course.findUnique({ where: { id: input.courseId }, select: { status: true, title: true } });
  if (!course || course.status === "DRAFT") throw new LiveClassError("Publish the course before scheduling live classes.");
  const live = await db().liveClass.create({
    data: { courseId: input.courseId, title: input.title, description: input.description, startsAt: input.startsAt, durationMinutes: input.durationMinutes, meetingUrl: input.meetingUrl, createdById: actor.id },
  });
  await audit({ actorId: actor.id, action: "live.created", entityType: "LiveClass", entityId: live.id, metadata: { course: course.title, title: live.title, startsAt: live.startsAt.toISOString() } });
  await tellStudents(live.id, "scheduled");
  return live;
}

export async function updateLiveClass(id: string, input: LiveClassInput, actor: Actor) {
  const before = await db().liveClass.findUnique({ where: { id } });
  if (!before) throw new LiveClassError("Class not found.", 404);
  await assertCanManage(actor, before.courseId);
  if (input.courseId !== before.courseId) throw new LiveClassError("A class can't be moved to another course; cancel it and schedule a new one.");
  if (before.status === "CANCELLED") throw new LiveClassError("This class was cancelled.");
  const moved = before.startsAt.getTime() !== input.startsAt.getTime();
  if (moved && input.startsAt.getTime() <= Date.now()) throw new z.ZodError([{ code: "custom", path: ["date"], message: "Choose a time in the future", input: input.date }]);
  await db().liveClass.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      meetingUrl: input.meetingUrl,
      // A new time means fresh reminders.
      ...(moved && { reminderDaySentAt: null, reminderHourSentAt: null }),
    },
  });
  await audit({ actorId: actor.id, action: "live.updated", entityType: "LiveClass", entityId: id, metadata: { title: input.title, moved } });
  if (moved) await tellStudents(id, "moved");
}

export async function cancelLiveClass(id: string, actor: Actor) {
  const live = await db().liveClass.findUnique({ where: { id } });
  if (!live) throw new LiveClassError("Class not found.", 404);
  await assertCanManage(actor, live.courseId);
  if (live.status === "CANCELLED") return;
  await db().liveClass.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit({ actorId: actor.id, action: "live.cancelled", entityType: "LiveClass", entityId: id, metadata: { title: live.title } });
  if (live.startsAt.getTime() > Date.now()) await tellStudents(id, "cancelled");
}

export async function staffLiveClasses(actor: Actor, when: "upcoming" | "past") {
  const now = new Date();
  // Classes stay under "upcoming" for 6 hours after they start, so a running class is easy to find.
  const where: Prisma.LiveClassWhereInput = {
    course: can(actor.role, "courses.manage.all") ? {} : manageableCoursesWhere(actor),
    ...(when === "upcoming" ? { startsAt: { gte: new Date(now.getTime() - 6 * 3600_000) } } : { startsAt: { lt: new Date(now.getTime() - 6 * 3600_000) } }),
  };
  return db().liveClass.findMany({
    where,
    orderBy: { startsAt: when === "upcoming" ? "asc" : "desc" },
    take: when === "upcoming" ? 200 : 50,
    include: { course: { select: { id: true, title: true, _count: { select: { enrollments: { where: { status: "APPROVED" } } } } } } },
  });
}

export function schedulableCourses(actor: Actor) {
  return db().course.findMany({
    where: { ...(can(actor.role, "courses.manage.all") ? {} : manageableCoursesWhere(actor)), status: { in: [...LEARNABLE] } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/** Classes for the student's approved, open courses: upcoming (incl. live now) and the last week's. */
export async function studentLiveClasses(userId: string) {
  const now = Date.now();
  const rows = await db().liveClass.findMany({
    where: {
      startsAt: { gte: new Date(now - 7 * 24 * 3600_000) },
      course: { status: { in: [...LEARNABLE] }, enrollments: { some: { userId, status: "APPROVED" } } },
    },
    orderBy: { startsAt: "asc" },
    include: { course: { select: { title: true, titleUr: true, slug: true } } },
  });
  const upcoming = rows.filter((r) => endsAt(r).getTime() > now);
  const past = rows.filter((r) => endsAt(r).getTime() <= now && r.status === "SCHEDULED").reverse();
  return { upcoming, past };
}

/** "live" from 15 minutes before the start until the end. */
export function liveState(c: { startsAt: Date; durationMinutes: number; status: string }, now = Date.now()) {
  if (c.status === "CANCELLED") return "cancelled" as const;
  if (now >= endsAt(c).getTime()) return "ended" as const;
  if (now >= c.startsAt.getTime() - 15 * 60_000) return "live" as const;
  return "upcoming" as const;
}

/** A class the viewer may see (approved student of the course, or staff who manage it). */
export async function liveClassForViewer(id: string, viewer: Actor) {
  const live = await db().liveClass.findUnique({ where: { id }, include: { course: { select: { title: true, slug: true, status: true } } } });
  if (!live) return null;
  if (await canManageCourse(viewer, live.courseId)) return live;
  const ok = await db().enrollment.findFirst({ where: { userId: viewer.id, courseId: live.courseId, status: "APPROVED" }, select: { id: true } });
  return ok && (LEARNABLE as readonly string[]).includes(live.course.status) ? live : null;
}

// ---------------------------------------------------------------------------
// Calendar file (.ics)
// ---------------------------------------------------------------------------

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Lines longer than 75 octets are folded (RFC 5545). */
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export function liveClassIcs(c: { id: string; title: string; description: string | null; startsAt: Date; durationMinutes: number; meetingUrl: string | null; status: string; updatedAt: Date; course: { title: string } }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Digitals Minds//Live classes//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.id}@digitalsminds.com`,
    `DTSTAMP:${icsDate(c.updatedAt)}`,
    `DTSTART:${icsDate(c.startsAt)}`,
    `DTEND:${icsDate(endsAt(c))}`,
    `SUMMARY:${icsText(`${c.title} (${c.course.title})`)}`,
    `DESCRIPTION:${icsText([c.description, `Join: ${c.meetingUrl}`].filter(Boolean).join("\n\n"))}`,
    ...(c.meetingUrl ? [`LOCATION:${icsText(c.meetingUrl)}`, `URL:${c.meetingUrl}`] : []),
    `STATUS:${c.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(c.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Messages to students (best effort)
// ---------------------------------------------------------------------------

function whenText(startsAt: Date, locale: Locale) {
  return new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Karachi" }).format(startsAt) + " (PKT)";
}

type Kind = "scheduled" | "moved" | "cancelled" | "remindDay" | "remindHour";

async function tellStudents(liveId: string, kind: Kind) {
  try {
    const live = await db().liveClass.findUniqueOrThrow({ where: { id: liveId }, include: { course: { select: { title: true, titleUr: true, slug: true } } } });
    const students = await approvedStudents(live.courseId);
    const email = kind !== "scheduled";
    for (const s of students) {
      const locale: Locale = s.preferredLocale === "ur" ? "ur" : "en";
      const dict = getDictionary(locale);
      const t = dict.live;
      const values = { title: live.title, course: (locale === "ur" && live.course.titleUr) || live.course.title, when: whenText(live.startsAt, locale) };
      const subject = format({ scheduled: t.msgScheduled, moved: t.msgMoved, cancelled: t.msgCancelled, remindDay: t.msgRemindDay, remindHour: t.msgRemindHour }[kind], values);
      await notify(s.id, { type: "SYSTEM", title: subject, body: kind === "cancelled" ? null : values.when, link: "/account/live" });
      if (!email) continue;
      await sendMail(
        actionEmail({
          dict,
          locale,
          to: s.email,
          name: s.name,
          subject,
          intro: format(kind === "cancelled" ? t.emailCancelledIntro : t.emailIntro, values),
          buttonLabel: kind === "cancelled" ? t.emailOpenPortal : t.emailJoinButton,
          url: `${siteConfig.url}${localizePath("/account/live", locale)}`,
          ignoreNote: false,
        }),
      ).catch((err) => console.warn("[live] email not sent:", err instanceof Error ? err.message : err));
    }
  } catch (err) {
    console.warn(`[live] ${kind} message failed:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Sends reminders that are due: 1 day before (when the class is less than 24 h
 * away) and 1 hour before. Each is claimed in the database first, so it goes
 * out once even if two server processes run this at the same time.
 */
export async function sendDueReminders(now = new Date()) {
  const t = now.getTime();
  const sent: { id: string; kind: "day" | "hour" }[] = [];
  const hourDue = await db().liveClass.findMany({
    where: { status: "SCHEDULED", reminderHourSentAt: null, startsAt: { gt: now, lte: new Date(t + 60 * 60_000) } },
    select: { id: true },
  });
  for (const { id } of hourDue) {
    const claimed = await db().liveClass.updateMany({ where: { id, reminderHourSentAt: null }, data: { reminderHourSentAt: now, reminderDaySentAt: now } });
    if (claimed.count) {
      await tellStudents(id, "remindHour");
      sent.push({ id, kind: "hour" });
    }
  }
  const dayDue = await db().liveClass.findMany({
    where: { status: "SCHEDULED", reminderDaySentAt: null, startsAt: { gt: new Date(t + 60 * 60_000), lte: new Date(t + 24 * 3600_000) } },
    select: { id: true },
  });
  for (const { id } of dayDue) {
    const claimed = await db().liveClass.updateMany({ where: { id, reminderDaySentAt: null }, data: { reminderDaySentAt: now } });
    if (claimed.count) {
      await tellStudents(id, "remindDay");
      sent.push({ id, kind: "day" });
    }
  }
  return sent;
}
