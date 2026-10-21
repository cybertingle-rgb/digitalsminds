import "server-only";
import type { EnrollmentStage, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";

/**
 * The student portal's data. Every query here is scoped to the signed-in
 * student's own enrollments; batch details (joining info, meeting links,
 * documents) are shown only to that batch's enrolled students.
 */

/** Stages that see their batch's details, documents and certificate. */
export const PORTAL_STAGES = ["ENROLLMENT_CONFIRMED", "ONBOARDING", "ACTIVE", "COMPLETED"] as const satisfies readonly EnrollmentStage[];
/** Stages that get the class schedule, joining links and notices. */
export const ACTIVE_STAGES = ["ENROLLMENT_CONFIRMED", "ONBOARDING", "ACTIVE"] as const satisfies readonly EnrollmentStage[];

/** Enrollments made before stages existed: an approved one counts as active (or completed). */
export function effectiveStage(e: { stage: EnrollmentStage | null; status: string; completedAt: Date | null }): EnrollmentStage | null {
  if (e.stage) return e.stage;
  if (e.status === "APPROVED") return e.completedAt ? "COMPLETED" : "ACTIVE";
  if (e.status === "REVOKED") return "WITHDRAWN";
  return null;
}

const enrollmentView = {
  id: true,
  stage: true,
  status: true,
  stageAt: true,
  completedAt: true,
  decidedAt: true,
  createdAt: true,
  courseId: true,
  batchId: true,
  course: { select: { id: true, title: true, titleUr: true, slug: true, format: true, durationText: true, certificateEnabled: true } },
  batch: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      startDate: true,
      endDate: true,
      scheduleText: true,
      meetingUrl: true,
      joiningInfo: true,
      coordinator: { select: { name: true } },
    },
  },
  events: { orderBy: { createdAt: "asc" }, select: { stage: true, note: true, createdAt: true } },
  application: {
    select: {
      reference: true,
      events: { orderBy: { createdAt: "asc" }, select: { stage: true, note: true, createdAt: true } },
      payments: { orderBy: { createdAt: "desc" }, select: { id: true, amount: true, amountReceived: true, method: true, reference: true, status: true, createdAt: true, decidedAt: true, receiptKey: true } },
    },
  },
} satisfies Prisma.EnrollmentSelect;

export type MyEnrollment = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentView }> & { effective: EnrollmentStage };

/** The student's enrollments (newest first), without open requests from the retired free-access flow. */
export async function myEnrollments(userId: string): Promise<MyEnrollment[]> {
  const rows = await db().enrollment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: enrollmentView });
  return rows.flatMap((r) => {
    const effective = effectiveStage(r);
    return effective ? [{ ...r, effective }] : [];
  });
}

const isActive = (e: { effective: EnrollmentStage }) => (ACTIVE_STAGES as readonly string[]).includes(e.effective);
const inPortal = (e: { effective: EnrollmentStage }) => (PORTAL_STAGES as readonly string[]).includes(e.effective);

/** Which batches and programs the student currently belongs to. */
export async function studentScope(userId: string) {
  const mine = await myEnrollments(userId);
  const active = mine.filter(isActive);
  const portal = mine.filter(inPortal);
  return {
    enrollments: mine,
    activeBatchIds: active.flatMap((e) => (e.batchId ? [e.batchId] : [])),
    activeCourseIds: active.map((e) => e.courseId),
    portalBatchIds: portal.flatMap((e) => (e.batchId ? [e.batchId] : [])),
    portalCourseIds: portal.map((e) => e.courseId),
  };
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

/** Checklist items that apply to an enrollment: for everyone, its program, or its batch. */
function itemsWhere(e: { courseId: string; batchId: string | null }): Prisma.OnboardingItemWhereInput {
  return {
    archivedAt: null,
    OR: [{ courseId: null, batchId: null }, { courseId: e.courseId, batchId: null }, ...(e.batchId ? [{ batchId: e.batchId }] : [])],
  };
}

export async function onboardingFor(e: { id: string; courseId: string; batchId: string | null }) {
  const [items, done] = await Promise.all([
    db().onboardingItem.findMany({ where: itemsWhere(e), orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db().onboardingProgress.findMany({ where: { enrollmentId: e.id }, select: { itemId: true, completedAt: true } }),
  ]);
  const doneAt = new Map(done.map((d) => [d.itemId, d.completedAt]));
  const list = items.map((i) => ({ ...i, completedAt: doneAt.get(i.id) ?? null }));
  const required = list.filter((i) => i.required);
  return { items: list, requiredDone: required.filter((i) => i.completedAt).length, requiredTotal: required.length };
}

async function recordStage(enrollmentId: string, from: EnrollmentStage, to: EnrollmentStage, actorId: string | null) {
  const moved = await db().enrollment.updateMany({ where: { id: enrollmentId, stage: from }, data: { stage: to, stageAt: new Date() } });
  if (moved.count) await db().enrollmentEvent.create({ data: { enrollmentId, stage: to, actorId } });
  return moved.count > 0;
}

/**
 * Moves the student along automatically: a confirmed enrollment starts
 * onboarding when they first open the portal, and becomes active once every
 * required checklist item is done (straight away if there is none).
 */
export async function advanceStages(userId: string) {
  const rows = await db().enrollment.findMany({ where: { userId, stage: { in: ["ENROLLMENT_CONFIRMED", "ONBOARDING"] } }, select: { id: true, stage: true, courseId: true, batchId: true } });
  for (const e of rows) {
    if (e.stage === "ENROLLMENT_CONFIRMED") await recordStage(e.id, "ENROLLMENT_CONFIRMED", "ONBOARDING", null);
    const { requiredDone, requiredTotal } = await onboardingFor(e);
    if (requiredDone >= requiredTotal) await recordStage(e.id, "ONBOARDING", "ACTIVE", null);
  }
}

export class PortalError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "PortalError";
  }
}

/** The student ticks (or unticks) one of their own checklist items. */
export async function setOnboardingItem(userId: string, enrollmentId: string, itemId: string, done: boolean) {
  const e = await db().enrollment.findUnique({ where: { id: enrollmentId }, select: { id: true, userId: true, stage: true, courseId: true, batchId: true } });
  if (!e || e.userId !== userId || !e.stage || !(ACTIVE_STAGES as readonly string[]).includes(e.stage)) throw new PortalError("notFound", 404);
  const item = await db().onboardingItem.findFirst({ where: { id: itemId, ...itemsWhere(e) } });
  if (!item) throw new PortalError("notFound", 404);
  // Some steps are confirmed by staff (e.g. "documents checked"); students can't tick those.
  if (!item.studentCompletes) throw new PortalError("staffOnly", 403);
  if (done) {
    await db().onboardingProgress.upsert({ where: { enrollmentId_itemId: { enrollmentId, itemId } }, create: { enrollmentId, itemId, completedById: userId }, update: {} });
  } else {
    await db().onboardingProgress.deleteMany({ where: { enrollmentId, itemId } });
  }
  await audit({ actorId: userId, action: done ? "onboarding.checked" : "onboarding.unchecked", entityType: "Enrollment", entityId: enrollmentId, metadata: { item: item.title } });
  await advanceStages(userId);
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Published documents for everyone, the student's programs, or their batches. */
export async function myDocuments(userId: string) {
  const scope = await studentScope(userId);
  if (!scope.portalCourseIds.length) return [];
  return db().studentDocument.findMany({
    where: {
      published: true,
      OR: [
        { courseId: null, batchId: null },
        { courseId: { in: scope.portalCourseIds }, batchId: null },
        ...(scope.portalBatchIds.length ? [{ batchId: { in: scope.portalBatchIds } }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, title: true, description: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, course: { select: { title: true } }, batch: { select: { name: true } } },
  });
}

/** Whether a student may download a document (same rules as the list). */
export async function studentCanOpenDocument(userId: string, documentId: string) {
  return (await myDocuments(userId)).some((d) => d.id === documentId);
}

// ---------------------------------------------------------------------------
// Notices (announcements) and schedule
// ---------------------------------------------------------------------------

/** Announcements for the student: everyone, their active programs, or their active batches. */
export async function myNotices(userId: string, take = 50) {
  const scope = await studentScope(userId);
  if (!scope.activeCourseIds.length) return [];
  return db().announcement.findMany({
    where: {
      publishedAt: { not: null },
      OR: [
        { courseId: null, batchId: null },
        { courseId: { in: scope.activeCourseIds }, batchId: null },
        ...(scope.activeBatchIds.length ? [{ batchId: { in: scope.activeBatchIds } }] : []),
      ],
    },
    orderBy: { publishedAt: "desc" },
    take,
    include: { course: { select: { title: true, titleUr: true } }, batch: { select: { name: true } } },
  });
}
