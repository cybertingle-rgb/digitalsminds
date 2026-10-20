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

export class EnrollmentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "EnrollmentError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
export type EnrollmentStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED";

export const requestInput = z.object({
  googleEmail: z.email().max(254).transform((v) => v.trim().toLowerCase()),
  note: z.string().trim().max(1000).optional().transform((v) => v || null),
});

export function enrollmentFor(userId: string, courseId: string) {
  return db().enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

/**
 * A student asks to join a published course. Rejected or revoked students may
 * ask again; the Google email is saved to their profile for Drive sharing.
 * Errors are message keys from dict.courses so the page can translate them.
 */
export async function requestEnrollment(user: Pick<CurrentUser, "id">, courseId: string, input: z.infer<typeof requestInput>) {
  const course = await db().course.findUnique({ where: { id: courseId }, select: { id: true, status: true, title: true } });
  if (!course || course.status !== "PUBLISHED") throw new EnrollmentError("notAvailable", 404);
  const existing = await enrollmentFor(user.id, courseId);
  if (existing?.status === "REQUESTED") throw new EnrollmentError("alreadyRequested", 409);
  if (existing?.status === "APPROVED") throw new EnrollmentError("alreadyEnrolled", 409);

  const reset = { status: "REQUESTED" as const, requestNote: input.note, requestedAt: new Date(), decidedAt: null, decidedById: null, decisionNote: null };
  const [enrollment] = await db().$transaction([
    existing
      ? db().enrollment.update({ where: { id: existing.id }, data: reset })
      : db().enrollment.create({ data: { userId: user.id, courseId, ...reset } }),
    db().user.update({ where: { id: user.id }, data: { googleEmail: input.googleEmail } }),
  ]);
  await audit({ actorId: user.id, action: "enrollment.requested", entityType: "Enrollment", entityId: enrollment.id, metadata: { course: course.title } });
  await sendRequestAlert(enrollment.id);
  return enrollment;
}

/** Allowed admin decisions from each state. */
const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["REVOKED"],
  REJECTED: ["APPROVED"],
  REVOKED: ["APPROVED"],
};

export async function decideEnrollment(id: string, decision: "APPROVED" | "REJECTED" | "REVOKED", note: string | null, actor: Actor) {
  if (!can(actor.role, "enrollments.decide")) throw new EnrollmentError("You don't have permission to do that.", 403);
  const enrollment = await db().enrollment.findUnique({ where: { id }, include: { course: { select: { title: true } } } });
  if (!enrollment) throw new EnrollmentError("Request not found.", 404);
  if (!TRANSITIONS[enrollment.status].includes(decision)) {
    throw new EnrollmentError("This request was already handled. Refresh the page to see its current status.", 409);
  }
  await db().enrollment.update({
    where: { id },
    data: { status: decision, decidedAt: new Date(), decidedById: actor.id, decisionNote: decision === "APPROVED" ? null : note },
  });
  const action = { APPROVED: "enrollment.approved", REJECTED: "enrollment.rejected", REVOKED: "enrollment.revoked" }[decision];
  await audit({ actorId: actor.id, action, entityType: "Enrollment", entityId: id, metadata: { course: enrollment.course.title, from: enrollment.status } });
  await notifyDecision(id);
  if (decision !== "REVOKED") await sendDecisionEmail(id);
}

// ---------------------------------------------------------------------------
// Admin queue
// ---------------------------------------------------------------------------

export type QueueFilter = { status: EnrollmentStatus; courseId?: string; q?: string };

export function parseQueueFilter(sp: Record<string, string | string[] | undefined>): QueueFilter {
  const one = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const status = (["REQUESTED", "APPROVED", "REJECTED", "REVOKED"] as const).find((s) => s === sp.status) ?? "REQUESTED";
  return { status, courseId: one(sp.course).slice(0, 64) || undefined, q: one(sp.q).slice(0, 100) || undefined };
}

export async function listEnrollments(filter: QueueFilter, page: number, pageSize: number) {
  const where: Prisma.EnrollmentWhereInput = {
    status: filter.status,
    ...(filter.courseId ? { courseId: filter.courseId } : {}),
    ...(filter.q
      ? { userId: { in: await idsContaining("User", ["name", "email", "googleEmail"], filter.q) } }
      : {}),
  };
  const [items, total, counts] = await Promise.all([
    db().enrollment.findMany({
      where,
      orderBy: filter.status === "REQUESTED" ? { requestedAt: "asc" } : { decidedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true, googleEmail: true, phone: true, city: true, status: true } },
        course: {
          select: {
            id: true,
            title: true,
            status: true,
            modules: { orderBy: { position: "asc" }, select: { lessons: { orderBy: { position: "asc" }, select: { title: true, videoUrl: true } } } },
          },
        },
        decidedBy: { select: { name: true } },
      },
    }),
    db().enrollment.count({ where }),
    db().enrollment.groupBy({ by: ["status"], where: filter.courseId ? { courseId: filter.courseId } : {}, _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<EnrollmentStatus, number>>;
  return { items, total, byStatus };
}

export function pendingRequestCount() {
  return db().enrollment.count({ where: { status: "REQUESTED" } });
}

// ---------------------------------------------------------------------------
// Emails (best effort: the decision is saved either way)
// ---------------------------------------------------------------------------

async function sendRequestAlert(enrollmentId: string) {
  try {
    const setting = await getLeadAlertSetting();
    if (!setting.enabled) return;
    const e = await db().enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { user: true, course: { select: { title: true } } } });
    const dict = getDictionary("en");
    const values = { name: e.user.name, email: e.user.email, course: e.course.title, google: e.user.googleEmail ?? "-" };
    await sendMail(
      actionEmail({
        dict,
        locale: "en",
        to: setting.email,
        name: "Digitals Minds team",
        subject: format(dict.emails.requestAlertSubject, values),
        intro: format(dict.emails.requestAlertIntro, values),
        buttonLabel: dict.emails.requestAlertButton,
        url: `${siteConfig.url}/admin/enrollments`,
      }),
    );
  } catch (err) {
    console.warn("[enrollment] request alert not sent:", err instanceof Error ? err.message : err);
  }
}

/** In-app notification for the student, in their preferred language. */
async function notifyDecision(enrollmentId: string) {
  const e = await db().enrollment.findUnique({ where: { id: enrollmentId }, include: { user: true, course: true } });
  if (!e || e.status === "REQUESTED") return;
  const locale: Locale = e.user.preferredLocale === "ur" ? "ur" : "en";
  const t = getDictionary(locale).notifications;
  const course = locale === "ur" ? e.course.titleUr || e.course.title : e.course.title;
  const kind = { APPROVED: "ENROLLMENT_APPROVED", REJECTED: "ENROLLMENT_REJECTED", REVOKED: "ENROLLMENT_REVOKED" } as const;
  const title = { APPROVED: t.enrollmentApproved, REJECTED: t.enrollmentRejected, REVOKED: t.enrollmentRevoked }[e.status];
  await notify(e.userId, {
    type: kind[e.status],
    title: format(title, { course }),
    body: e.status === "APPROVED" ? null : e.decisionNote,
    link: e.status === "APPROVED" ? `/learn/${e.course.slug}` : `/courses/${e.course.slug}`,
  });
}

async function sendDecisionEmail(enrollmentId: string) {
  try {
    const e = await db().enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { user: true, course: true } });
    const locale: Locale = e.user.preferredLocale === "ur" ? "ur" : "en";
    const dict = getDictionary(locale);
    const t = dict.emails;
    const course = locale === "ur" ? e.course.titleUr || e.course.title : e.course.title;
    const approved = e.status === "APPROVED";
    const intro = approved
      ? format(t.approvedIntro, { course, google: e.user.googleEmail ?? e.user.email })
      : [format(t.rejectedIntro, { course }), e.decisionNote ? format(t.rejectedReason, { note: e.decisionNote }) : ""].filter(Boolean).join(" ");
    await sendMail(
      actionEmail({
        dict,
        locale,
        to: e.user.email,
        name: e.user.name,
        subject: format(approved ? t.approvedSubject : t.rejectedSubject, { course }),
        intro,
        buttonLabel: approved ? t.approvedButton : t.rejectedButton,
        url: `${siteConfig.url}${localizePath(approved ? `/learn/${e.course.slug}` : "/courses", locale)}`,
      }),
    );
  } catch (err) {
    console.warn("[enrollment] decision email not sent:", err instanceof Error ? err.message : err);
  }
}

/** Approved students of a course with their completed-lesson counts (course editor). */
export async function courseStudents(courseId: string) {
  const [enrolled, waiting, lessonCount] = await Promise.all([
    db().enrollment.findMany({
      where: { courseId, status: "APPROVED" },
      orderBy: { decidedAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true, googleEmail: true } } },
    }),
    db().enrollment.count({ where: { courseId, status: "REQUESTED" } }),
    db().lesson.count({ where: { module: { courseId } } }),
  ]);
  const done = enrolled.length
    ? await db().lessonProgress.groupBy({
        by: ["userId"],
        where: { userId: { in: enrolled.map((e) => e.userId) }, completedAt: { not: null }, lesson: { module: { courseId } } },
        _count: { _all: true },
      })
    : [];
  const doneBy = new Map(done.map((d) => [d.userId, d._count._all]));
  return { waiting, lessonCount, students: enrolled.map((e) => ({ ...e.user, done: doneBy.get(e.userId) ?? 0 })) };
}

/**
 * Staff enroll a student directly (no request needed), e.g. after a phone call.
 * The student gets the usual approval email.
 */
export async function manualEnroll(userId: string, courseId: string, actor: Actor) {
  if (!can(actor.role, "enrollments.decide")) throw new EnrollmentError("You don't have permission to do that.", 403);
  const [student, course] = await Promise.all([
    db().user.findUnique({ where: { id: userId }, select: { role: true, status: true } }),
    db().course.findUnique({ where: { id: courseId }, select: { status: true, title: true } }),
  ]);
  if (!student || student.role !== "STUDENT") throw new EnrollmentError("Student not found.", 404);
  if (student.status !== "ACTIVE") throw new EnrollmentError("Reactivate this account before enrolling it in a course.");
  if (!course || course.status === "DRAFT") throw new EnrollmentError("Choose a published or archived course.");
  const existing = await enrollmentFor(userId, courseId);
  if (existing?.status === "APPROVED") throw new EnrollmentError("This student is already enrolled in that course.", 409);
  const data = { status: "APPROVED" as const, decidedAt: new Date(), decidedById: actor.id, decisionNote: null };
  const enrollment = existing
    ? await db().enrollment.update({ where: { id: existing.id }, data })
    : await db().enrollment.create({ data: { userId, courseId, ...data } });
  await audit({ actorId: actor.id, action: "enrollment.manual", entityType: "Enrollment", entityId: enrollment.id, metadata: { course: course.title, from: existing?.status ?? null } });
  await notifyDecision(enrollment.id);
  await sendDecisionEmail(enrollment.id);
  return enrollment;
}
