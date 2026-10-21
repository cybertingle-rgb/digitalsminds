import "server-only";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import type { Prisma, SessionKind } from "@/generated/prisma/client";
import { localeMeta, localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { meetingUrlSchema } from "@/lib/meeting-url";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { canCoordinate } from "@/modules/batches/service";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";
import { ACTIVE_STAGES, studentScope } from "@/modules/portal/service";

/**
 * Batch schedules: live classes (Zoom / Google Meet / Teams), holidays and
 * other events for one batch. Super Admins, Content Managers and the batch's
 * coordinator manage them; the batch's enrolled students see them in their
 * portal and get reminders 1 day and 1 hour before a class. Times are entered
 * and shown in Pakistan time (UTC+5, no daylight saving) and stored in UTC.
 */

export class LiveClassError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "LiveClassError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
const PK_OFFSET = "+05:00";
export const SESSION_KINDS = ["CLASS", "HOLIDAY", "EVENT"] as const satisfies readonly SessionKind[];

export const liveClassInput = z
  .object({
    batchId: z.string().min(1, "Choose a batch").max(64),
    kind: z.enum(SESSION_KINDS),
    title: z.string().trim().min(3, "Enter a title").max(200),
    description: z.string().trim().max(5000).optional().transform((v) => v || null),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    time: z.string().optional(),
    durationMinutes: z.string().optional(),
    meetingUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), meetingUrlSchema.optional()),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "HOLIDAY") return;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time ?? "")) ctx.addIssue({ code: "custom", path: ["time"], message: "Choose a time" });
    const d = Number(v.durationMinutes);
    if (!Number.isInteger(d) || d < 15 || d > 600) ctx.addIssue({ code: "custom", path: ["durationMinutes"], message: "15 to 600 minutes" });
  })
  .transform((v) => {
    // A holiday covers the whole day; it has no time, length or link.
    const holiday = v.kind === "HOLIDAY";
    return {
      batchId: v.batchId,
      kind: v.kind,
      title: v.title,
      description: v.description,
      date: v.date,
      startsAt: new Date(`${v.date}T${holiday ? "00:00" : v.time}:00${PK_OFFSET}`),
      durationMinutes: holiday ? 24 * 60 : Number(v.durationMinutes),
      meetingUrl: holiday ? null : (v.meetingUrl ?? null),
    };
  });
export type LiveClassInput = z.infer<typeof liveClassInput>;

/** Date and time parts in Pakistan time, for edit forms. */
export function pkParts(d: Date) {
  const pk = new Date(d.getTime() + 5 * 3600_000).toISOString();
  return { date: pk.slice(0, 10), time: pk.slice(11, 16) };
}

export const endsAt = (c: { startsAt: Date; durationMinutes: number }) => new Date(c.startsAt.getTime() + c.durationMinutes * 60_000);

/** The link students join with: the session's own, else the batch's default (never for holidays). */
export function joinUrl(c: { kind: SessionKind; meetingUrl: string | null; batch?: { meetingUrl: string | null } | null }) {
  return c.kind === "HOLIDAY" ? null : (c.meetingUrl ?? c.batch?.meetingUrl ?? null);
}

async function assertCanSchedule(actor: Actor, batchId: string) {
  if (!(await canCoordinate(actor, batchId))) throw new LiveClassError("You can only schedule sessions for batches you manage or coordinate.", 403);
}

/** Students who get a session's messages: the batch's current students (or, for older course-wide classes, the course's). */
function recipientsWhere(live: { batchId: string | null; courseId: string }): Prisma.UserWhereInput {
  return live.batchId
    ? { status: "ACTIVE", enrollments: { some: { batchId: live.batchId, stage: { in: [...ACTIVE_STAGES] } } } }
    : { status: "ACTIVE", enrollments: { some: { courseId: live.courseId, status: "APPROVED" } } };
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export async function createLiveClass(input: LiveClassInput, actor: Actor) {
  await assertCanSchedule(actor, input.batchId);
  const batch = await db().batch.findUnique({ where: { id: input.batchId }, select: { courseId: true, status: true, name: true } });
  if (!batch) throw new LiveClassError("Batch not found.", 404);
  if (batch.status === "CANCELLED" || batch.status === "COMPLETED") throw new LiveClassError("This batch is completed or cancelled.");
  const earliest = input.kind === "HOLIDAY" ? Date.now() - 24 * 3600_000 : Date.now();
  if (input.startsAt.getTime() <= earliest) throw new z.ZodError([{ code: "custom", path: ["date"], message: "Choose a date in the future", input: input.date }]);
  const live = await db().liveClass.create({
    data: {
      courseId: batch.courseId,
      batchId: input.batchId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      meetingUrl: input.meetingUrl,
      createdById: actor.id,
      // Holidays get no reminders.
      ...(input.kind === "HOLIDAY" && { reminderDaySentAt: new Date(), reminderHourSentAt: new Date() }),
    },
  });
  await audit({ actorId: actor.id, action: "live.created", entityType: "LiveClass", entityId: live.id, metadata: { batch: batch.name, title: live.title, kind: live.kind, startsAt: live.startsAt.toISOString() } });
  await tellStudents(live.id, input.kind === "HOLIDAY" ? "holiday" : "scheduled");
  return live;
}

export async function updateLiveClass(id: string, input: LiveClassInput, actor: Actor) {
  const before = await db().liveClass.findUnique({ where: { id } });
  if (!before) throw new LiveClassError("Session not found.", 404);
  if (!before.batchId) throw new LiveClassError("This older class isn't linked to a batch; cancel it and schedule a new one.");
  await assertCanSchedule(actor, before.batchId);
  if (input.batchId !== before.batchId) throw new LiveClassError("A session can't be moved to another batch; cancel it and schedule a new one.");
  if (before.status === "CANCELLED") throw new LiveClassError("This session was cancelled.");
  const moved = before.startsAt.getTime() !== input.startsAt.getTime();
  if (moved && input.startsAt.getTime() <= Date.now() && input.kind !== "HOLIDAY") {
    throw new z.ZodError([{ code: "custom", path: ["date"], message: "Choose a time in the future", input: input.date }]);
  }
  await db().liveClass.update({
    where: { id },
    data: {
      kind: input.kind,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      meetingUrl: input.meetingUrl,
      // A new time means fresh reminders (holidays never get any).
      ...(moved && input.kind !== "HOLIDAY" && { reminderDaySentAt: null, reminderHourSentAt: null }),
    },
  });
  await audit({ actorId: actor.id, action: "live.updated", entityType: "LiveClass", entityId: id, metadata: { title: input.title, moved } });
  if (moved) await tellStudents(id, "moved");
}

export async function cancelLiveClass(id: string, actor: Actor) {
  const live = await db().liveClass.findUnique({ where: { id } });
  if (!live) throw new LiveClassError("Session not found.", 404);
  if (live.batchId) await assertCanSchedule(actor, live.batchId);
  else if (!can(actor.role, "batches.manage")) throw new LiveClassError("You can't change this session.", 403);
  if (live.status === "CANCELLED") return;
  await db().liveClass.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit({ actorId: actor.id, action: "live.cancelled", entityType: "LiveClass", entityId: id, metadata: { title: live.title } });
  if (live.startsAt.getTime() > Date.now()) await tellStudents(id, "cancelled");
}

/** Batches whose sessions this staff member manages. */
function batchScope(actor: Actor): Prisma.BatchWhereInput {
  return can(actor.role, "batches.manage") ? {} : { coordinatorId: actor.id };
}

export async function staffLiveClasses(actor: Actor, when: "upcoming" | "past", batchId?: string) {
  const now = new Date();
  // Sessions stay under "upcoming" for 6 hours after they start, so a running class is easy to find.
  const where: Prisma.LiveClassWhereInput = {
    ...(can(actor.role, "batches.manage") ? {} : { batch: batchScope(actor) }),
    ...(batchId ? { batchId } : {}),
    ...(when === "upcoming" ? { startsAt: { gte: new Date(now.getTime() - 6 * 3600_000) } } : { startsAt: { lt: new Date(now.getTime() - 6 * 3600_000) } }),
  };
  return db().liveClass.findMany({
    where,
    orderBy: { startsAt: when === "upcoming" ? "asc" : "desc" },
    take: when === "upcoming" ? 200 : 50,
    include: {
      course: { select: { id: true, title: true } },
      batch: { select: { id: true, name: true, code: true, meetingUrl: true, _count: { select: { enrollments: { where: { stage: { in: [...ACTIVE_STAGES] } } } } } } },
    },
  });
}

/** Batches a staff member can add sessions to. */
export function schedulableBatches(actor: Actor) {
  return db().batch.findMany({
    where: { ...batchScope(actor), status: { notIn: ["CANCELLED", "COMPLETED", "DRAFT"] } },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, code: true, meetingUrl: true, course: { select: { title: true } } },
  });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/** The student's schedule: their batches' sessions (and older course-wide classes), upcoming and the last week's. */
export async function studentLiveClasses(userId: string) {
  const scope = await studentScope(userId);
  if (!scope.activeCourseIds.length) return { upcoming: [], past: [] };
  const now = Date.now();
  const rows = await db().liveClass.findMany({
    where: {
      startsAt: { gte: new Date(now - 7 * 24 * 3600_000) },
      OR: [...(scope.activeBatchIds.length ? [{ batchId: { in: scope.activeBatchIds } }] : []), { batchId: null, courseId: { in: scope.activeCourseIds } }],
    },
    orderBy: { startsAt: "asc" },
    include: { course: { select: { title: true, titleUr: true, slug: true } }, batch: { select: { name: true, meetingUrl: true } } },
  });
  const withLink = rows.map((r) => ({ ...r, meetingUrl: joinUrl(r) }));
  const upcoming = withLink.filter((r) => endsAt(r).getTime() > now);
  const past = withLink.filter((r) => endsAt(r).getTime() <= now && r.status === "SCHEDULED" && r.kind !== "HOLIDAY").reverse();
  return { upcoming, past };
}

/** "live" from 15 minutes before the start until the end. */
export function liveState(c: { startsAt: Date; durationMinutes: number; status: string }, now = Date.now()) {
  if (c.status === "CANCELLED") return "cancelled" as const;
  if (now >= endsAt(c).getTime()) return "ended" as const;
  if (now >= c.startsAt.getTime() - 15 * 60_000) return "live" as const;
  return "upcoming" as const;
}

/** A session the viewer may see: its batch's staff, or a current student of the batch. */
export async function liveClassForViewer(id: string, viewer: Actor) {
  const live = await db().liveClass.findUnique({ where: { id }, include: { course: { select: { title: true, slug: true, status: true } }, batch: { select: { meetingUrl: true } } } });
  if (!live) return null;
  const withLink = { ...live, meetingUrl: joinUrl(live) };
  if (live.batchId ? await canCoordinate(viewer, live.batchId) : can(viewer.role, "batches.manage")) return withLink;
  const scope = await studentScope(viewer.id);
  const allowed = live.batchId ? scope.activeBatchIds.includes(live.batchId) : scope.activeCourseIds.includes(live.courseId);
  return allowed ? withLink : null;
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
    "PRODID:-//Digitals Minds//Class schedule//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.id}@digitalsminds.com`,
    `DTSTAMP:${icsDate(c.updatedAt)}`,
    `DTSTART:${icsDate(c.startsAt)}`,
    `DTEND:${icsDate(endsAt(c))}`,
    `SUMMARY:${icsText(`${c.title} (${c.course.title})`)}`,
    `DESCRIPTION:${icsText([c.description, c.meetingUrl && `Join: ${c.meetingUrl}`].filter(Boolean).join("\n\n"))}`,
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

function whenText(startsAt: Date, locale: Locale, dateOnly = false) {
  return dateOnly
    ? new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "full", timeZone: "Asia/Karachi" }).format(startsAt)
    : new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Karachi" }).format(startsAt) + " (PKT)";
}

type Kind = "scheduled" | "holiday" | "moved" | "cancelled" | "remindDay" | "remindHour";

async function tellStudents(liveId: string, kind: Kind) {
  try {
    const live = await db().liveClass.findUniqueOrThrow({ where: { id: liveId }, include: { course: { select: { title: true, titleUr: true } } } });
    const students = await db().user.findMany({ where: recipientsWhere(live), select: { id: true, email: true, name: true, preferredLocale: true } });
    // New classes are announced in the portal only; changes, holidays and reminders also go by email.
    const email = kind !== "scheduled";
    for (const s of students) {
      const locale: Locale = s.preferredLocale === "ur" ? "ur" : "en";
      const dict = getDictionary(locale);
      const t = dict.live;
      const values = { title: live.title, course: live.course.title, when: whenText(live.startsAt, locale, live.kind === "HOLIDAY") };
      const subject = format({ scheduled: t.msgScheduled, holiday: t.msgHoliday, moved: t.msgMoved, cancelled: t.msgCancelled, remindDay: t.msgRemindDay, remindHour: t.msgRemindHour }[kind], values);
      await notify(s.id, { type: "SCHEDULE", title: subject, body: kind === "cancelled" ? null : values.when, link: "/account/schedule" });
      if (!email) continue;
      await sendMail(
        actionEmail({
          dict,
          locale,
          to: s.email,
          name: s.name,
          subject,
          intro: format(kind === "cancelled" ? t.emailCancelledIntro : kind === "holiday" ? t.emailHolidayIntro : t.emailIntro, values),
          buttonLabel: t.emailJoinButton,
          url: `${siteConfig.url}${localizePath("/account/schedule", locale)}`,
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
    where: { status: "SCHEDULED", kind: { not: "HOLIDAY" }, reminderHourSentAt: null, startsAt: { gt: now, lte: new Date(t + 60 * 60_000) } },
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
    where: { status: "SCHEDULED", kind: { not: "HOLIDAY" }, reminderDaySentAt: null, startsAt: { gt: new Date(t + 60 * 60_000), lte: new Date(t + 24 * 3600_000) } },
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
