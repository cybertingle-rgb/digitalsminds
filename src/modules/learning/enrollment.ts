import "server-only";
/**
 * Approval decisions for enrollments made through the old per-course flow
 * (before applications and batches). New enrollments are created by
 * verifying an application's payment (src/modules/admissions).
 */
import { siteConfig } from "@/config/site";
import { localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";

export class EnrollmentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "EnrollmentError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
export type EnrollmentStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "REVOKED";

export function enrollmentFor(userId: string, courseId: string) {
  return db().enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

/** Allowed admin decisions from each state. */
const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["REVOKED"],
  REJECTED: ["APPROVED"],
  REVOKED: ["APPROVED"],
};

/** A paid course is opened only by a confirmed payment, or by someone who manages payments (e.g. paid in cash). */
function assertCanOpenPaid(course: { accessType: string }, actor: Actor, paymentConfirmed: boolean) {
  if (course.accessType === "PAID" && !paymentConfirmed && !can(actor.role, "payments.manage")) {
    throw new EnrollmentError("This is a paid course: access opens when a Super Admin confirms the payment in Payments.", 403);
  }
}

export async function decideEnrollment(id: string, decision: "APPROVED" | "REJECTED" | "REVOKED", note: string | null, actor: Actor, opts: { paymentConfirmed?: boolean } = {}) {
  if (!can(actor.role, "enrollments.decide")) throw new EnrollmentError("You don't have permission to do that.", 403);
  const enrollment = await db().enrollment.findUnique({ where: { id }, include: { course: { select: { title: true, accessType: true } } } });
  if (!enrollment) throw new EnrollmentError("Request not found.", 404);
  if (decision === "APPROVED") assertCanOpenPaid(enrollment.course, actor, opts.paymentConfirmed === true);
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
// Emails (best effort: the decision is saved either way)
// ---------------------------------------------------------------------------

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
    link: e.status === "APPROVED" ? "/account" : `/courses/${e.course.slug}`,
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
        url: `${siteConfig.url}${localizePath(approved ? "/account" : "/courses", locale)}`,
      }),
    );
  } catch (err) {
    console.warn("[enrollment] decision email not sent:", err instanceof Error ? err.message : err);
  }
}
