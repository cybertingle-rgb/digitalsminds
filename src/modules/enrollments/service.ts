import "server-only";
import type { EnrollmentStage, Prisma } from "@/generated/prisma/client";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { SEAT_STAGES } from "@/modules/batches/rules";
import { canCoordinate } from "@/modules/batches/service";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";
import { onboardingFor } from "@/modules/portal/service";

/**
 * Student administration after enrollment: stage changes, transfers between
 * batches, withdrawals, and staff-confirmed onboarding steps. Every change is
 * recorded on the enrollment's timeline and in the activity log.
 */

export class EnrollmentAdminError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "EnrollmentAdminError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

/** Stage changes staff can make, from each stage. */
const NEXT: Partial<Record<EnrollmentStage, EnrollmentStage[]>> = {
  ENROLLMENT_CONFIRMED: ["ONBOARDING", "ACTIVE", "WITHDRAWN"],
  ONBOARDING: ["ACTIVE", "WITHDRAWN"],
  ACTIVE: ["COMPLETED", "ONBOARDING", "WITHDRAWN"],
  COMPLETED: ["ACTIVE"],
  WITHDRAWN: ["ACTIVE"],
};

export function allowedStages(from: EnrollmentStage | null) {
  return from ? (NEXT[from] ?? []) : [];
}

async function load(enrollmentId: string, actor: Actor) {
  const e = await db().enrollment.findUnique({
    where: { id: enrollmentId },
    include: { user: { select: { id: true, name: true, email: true } }, course: { select: { title: true } }, batch: { select: { id: true, name: true, code: true, capacity: true } } },
  });
  if (!e || !e.batchId) throw new EnrollmentAdminError("Enrollment not found.", 404);
  const staff = can(actor.role, "enrollments.decide") || (await canCoordinate(actor, e.batchId));
  if (!staff) throw new EnrollmentAdminError("Enrollment not found.", 404);
  return e;
}

async function seatsTakenLocked(tx: Prisma.TransactionClient, batchId: string) {
  await tx.$queryRaw`SELECT id FROM Batch WHERE id = ${batchId} FOR UPDATE`;
  return tx.enrollment.count({ where: { batchId, stage: { in: [...SEAT_STAGES] } } });
}

/** Move a student to another stage (withdrawing, and reinstating a withdrawn student, are Super Admin decisions). */
export async function setStage(enrollmentId: string, to: EnrollmentStage, note: string | null, actor: Actor) {
  const e = await load(enrollmentId, actor);
  if (!e.stage || !allowedStages(e.stage).includes(to)) throw new EnrollmentAdminError("That change isn't possible from the current stage. Refresh the page.", 409);
  if ((to === "WITHDRAWN" || e.stage === "WITHDRAWN") && !can(actor.role, "enrollments.admin")) {
    throw new EnrollmentAdminError("Only Super Admins can withdraw or reinstate students.", 403);
  }
  const reason = note?.trim().slice(0, 1000) || null;
  if (to === "WITHDRAWN" && !reason) throw new EnrollmentAdminError("Add a short reason for the withdrawal.");
  await db().$transaction(async (tx) => {
    // Reinstating takes a seat again, so check there is one.
    if (e.stage === "WITHDRAWN" && (await seatsTakenLocked(tx, e.batchId!)) >= e.batch!.capacity) {
      throw new EnrollmentAdminError(`${e.batch!.name} is full. Add seats or transfer the student first.`, 409);
    }
    const moved = await tx.enrollment.updateMany({
      where: { id: e.id, stage: e.stage! },
      data: {
        stage: to,
        stageAt: new Date(),
        status: to === "WITHDRAWN" ? "REVOKED" : "APPROVED",
        completedAt: to === "COMPLETED" ? new Date() : to === "ACTIVE" ? null : e.completedAt,
        ...(to === "WITHDRAWN" && { decisionNote: reason }),
      },
    });
    if (!moved.count) throw new EnrollmentAdminError("This enrollment changed meanwhile. Refresh the page.", 409);
    await tx.enrollmentEvent.create({ data: { enrollmentId: e.id, stage: to, note: reason, actorId: actor.id } });
  });
  await audit({ actorId: actor.id, action: "enrollment.stage", entityType: "Enrollment", entityId: e.id, metadata: { student: e.user.name, batch: e.batch!.code, from: e.stage, to } });
  await tellStudent(e, to, reason);
}

/** Move a student to another batch of the same program (seat checked in the new batch). */
export async function transfer(enrollmentId: string, batchId: string, note: string | null, actor: Actor) {
  if (!can(actor.role, "enrollments.admin")) throw new EnrollmentAdminError("Only Super Admins can transfer students.", 403);
  const e = await load(enrollmentId, actor);
  if (e.batchId === batchId) return;
  if (!e.stage || !(SEAT_STAGES as readonly string[]).includes(e.stage) || e.stage === "COMPLETED") {
    throw new EnrollmentAdminError("Only current students can be transferred.", 409);
  }
  const target = await db().batch.findUnique({ where: { id: batchId }, select: { id: true, courseId: true, name: true, code: true, capacity: true, status: true } });
  if (!target || target.courseId !== e.courseId) throw new EnrollmentAdminError("Choose a batch of the same program.");
  if (target.status === "CANCELLED" || target.status === "COMPLETED") throw new EnrollmentAdminError("That batch is completed or cancelled.");
  const text = `Transferred from ${e.batch!.name} to ${target.name}${note?.trim() ? `: ${note.trim()}` : ""}`.slice(0, 1000);
  await db().$transaction(async (tx) => {
    if ((await seatsTakenLocked(tx, target.id)) >= target.capacity) throw new EnrollmentAdminError(`${target.name} is full. Add seats first.`, 409);
    const moved = await tx.enrollment.updateMany({ where: { id: e.id, batchId: e.batchId }, data: { batchId: target.id } });
    if (!moved.count) throw new EnrollmentAdminError("This enrollment changed meanwhile. Refresh the page.", 409);
    await tx.enrollmentEvent.create({ data: { enrollmentId: e.id, stage: e.stage!, note: text, actorId: actor.id } });
  });
  await audit({ actorId: actor.id, action: "enrollment.transferred", entityType: "Enrollment", entityId: e.id, metadata: { student: e.user.name, from: e.batch!.code, to: target.code } });
  const dict = getDictionary("en");
  await notify(e.user.id, { type: "ENROLLMENT_UPDATE", title: format(dict.portal.transferTitle, { batch: target.name }), body: null, link: "/account/program" }).catch(() => {});
}

/** Staff tick (or untick) a checklist step for a student, e.g. "documents checked". */
export async function confirmOnboardingItem(enrollmentId: string, itemId: string, done: boolean, actor: Actor) {
  const e = await load(enrollmentId, actor);
  if (!can(actor.role, "onboarding.manage") && !(await canCoordinate(actor, e.batchId!))) throw new EnrollmentAdminError("Enrollment not found.", 404);
  const { items } = await onboardingFor(e);
  const item = items.find((i) => i.id === itemId);
  if (!item) throw new EnrollmentAdminError("Step not found.", 404);
  if (done) {
    await db().onboardingProgress.upsert({ where: { enrollmentId_itemId: { enrollmentId, itemId } }, create: { enrollmentId, itemId, completedById: actor.id }, update: {} });
  } else {
    await db().onboardingProgress.deleteMany({ where: { enrollmentId, itemId } });
  }
  await audit({ actorId: actor.id, action: done ? "onboarding.confirmed" : "onboarding.unconfirmed", entityType: "Enrollment", entityId: enrollmentId, metadata: { student: e.user.name, item: item.title } });
  // All required steps done: the student becomes active.
  if (e.stage === "ONBOARDING") {
    const after = await onboardingFor(e);
    if (after.requiredDone >= after.requiredTotal) {
      const moved = await db().enrollment.updateMany({ where: { id: e.id, stage: "ONBOARDING" }, data: { stage: "ACTIVE", stageAt: new Date() } });
      if (moved.count) await db().enrollmentEvent.create({ data: { enrollmentId: e.id, stage: "ACTIVE", actorId: actor.id } });
    }
  }
}

/** A batch's students with their stage and onboarding progress. */
export async function roster(batchId: string, actor: Actor) {
  if (!(await canCoordinate(actor, batchId)) && !can(actor.role, "enrollments.decide")) return null;
  const rows = await db().enrollment.findMany({
    where: { batchId },
    orderBy: [{ stage: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { id: true, name: true, email: true, phone: true, city: true, status: true } }, application: { select: { id: true, reference: true } } },
  });
  return Promise.all(rows.map(async (r) => ({ ...r, onboarding: await onboardingFor(r) })));
}

async function tellStudent(e: { user: { id: string; name: string; email: string }; course: { title: string } }, to: EnrollmentStage, note: string | null) {
  const dict = getDictionary("en");
  const t = dict.portal;
  const title = format(t.stageChanged, { program: e.course.title, stage: dict.apply.stages[to] });
  await notify(e.user.id, { type: "ENROLLMENT_UPDATE", title, body: note, link: "/account/program" }).catch(() => {});
  if (to !== "COMPLETED" && to !== "WITHDRAWN") return;
  try {
    await sendMail(
      actionEmail({
        dict,
        locale: "en",
        to: e.user.email,
        name: e.user.name,
        subject: title,
        intro: [to === "COMPLETED" ? format(t.emailCompletedIntro, { program: e.course.title }) : format(t.emailWithdrawnIntro, { program: e.course.title }), note ? format(dict.apply.noteFromTeam, { note }) : ""].filter(Boolean).join(" "),
        buttonLabel: dict.live.emailOpenPortal,
        url: `${siteConfig.url}/account/program`,
        ignoreNote: false,
      }),
    );
  } catch (err) {
    console.warn("[enrollments] email not sent:", err instanceof Error ? err.message : err);
  }
}
