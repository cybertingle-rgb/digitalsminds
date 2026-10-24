import "server-only";
import { z } from "zod";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import type { CurrentUser } from "@/modules/auth/session";
import { SEAT_STAGES } from "@/modules/batches/rules";
import { canCoordinate } from "@/modules/batches/service";

/**
 * Attendance for live classes, only in batches where it is switched on.
 * The batch's coordinator and managers mark it after a class; students see
 * their own record. Holidays and cancelled sessions are never marked.
 */

export class AttendanceError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AttendanceError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

export const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const satisfies readonly AttendanceStatus[];
/** Present or late count as attended. */
const ATTENDED: AttendanceStatus[] = ["PRESENT", "LATE"];

async function loadBatch(batchId: string, actor: Actor) {
  if (!(await canCoordinate(actor, batchId))) throw new AttendanceError("Batch not found.", 404);
  const batch = await db().batch.findUnique({ where: { id: batchId }, select: { id: true, name: true, code: true, timeZone: true, attendanceEnabled: true, course: { select: { title: true } } } });
  if (!batch) throw new AttendanceError("Batch not found.", 404);
  return batch;
}

/** Sessions that can be marked: classes and events of the batch that have started and weren't cancelled. */
function markableWhere(batchId: string, now = new Date()) {
  return { batchId, kind: { in: ["CLASS" as const, "EVENT" as const] }, status: "SCHEDULED" as const, startsAt: { lte: now } };
}

/** Students on the register: everyone who holds (or held, if completed) a seat in the batch. */
function registerWhere(batchId: string) {
  return { batchId, stage: { in: [...SEAT_STAGES] } };
}

export async function batchAttendance(batchId: string, actor: Actor) {
  const batch = await loadBatch(batchId, actor);
  const [classes, students] = await Promise.all([
    db().liveClass.findMany({
      where: markableWhere(batchId),
      orderBy: { startsAt: "desc" },
      select: { id: true, title: true, startsAt: true, durationMinutes: true, kind: true, _count: { select: { attendance: true } }, attendance: { where: { status: { in: ATTENDED } }, select: { id: true } } },
    }),
    db().enrollment.count({ where: registerWhere(batchId) }),
  ]);
  return { batch, students, classes: classes.map((c) => ({ ...c, marked: c._count.attendance, attended: c.attendance.length })) };
}

export async function attendanceSheet(batchId: string, liveClassId: string, actor: Actor) {
  const batch = await loadBatch(batchId, actor);
  const live = await db().liveClass.findFirst({ where: { id: liveClassId, ...markableWhere(batchId) }, select: { id: true, title: true, startsAt: true, durationMinutes: true } });
  if (!live) throw new AttendanceError("Class not found, not started yet, or not one that takes attendance.", 404);
  const [students, marks] = await Promise.all([
    db().enrollment.findMany({ where: registerWhere(batchId), orderBy: { user: { name: "asc" } }, select: { id: true, stage: true, user: { select: { name: true, email: true } } } }),
    db().attendance.findMany({ where: { liveClassId }, select: { enrollmentId: true, status: true, note: true } }),
  ]);
  const byEnrollment = new Map(marks.map((m) => [m.enrollmentId, m]));
  return { batch, live, rows: students.map((s) => ({ ...s, status: byEnrollment.get(s.id)?.status ?? null, note: byEnrollment.get(s.id)?.note ?? null })) };
}

export const marksInput = z
  .array(
    z.object({
      enrollmentId: z.string().min(1).max(64),
      /** "" clears the mark. */
      status: z.union([z.enum(ATTENDANCE_STATUSES), z.literal("")]),
      note: z.string().trim().max(300).optional().transform((v) => v || null),
    }),
  )
  .max(2000);

export async function saveAttendance(batchId: string, liveClassId: string, marks: z.infer<typeof marksInput>, actor: Actor) {
  const batch = await loadBatch(batchId, actor);
  if (!batch.attendanceEnabled) throw new AttendanceError("Attendance is switched off for this batch. Switch it on in the batch settings first.", 409);
  const live = await db().liveClass.findFirst({ where: { id: liveClassId, ...markableWhere(batchId) }, select: { id: true, title: true } });
  if (!live) throw new AttendanceError("Class not found, not started yet, or not one that takes attendance.", 404);
  const allowed = new Set((await db().enrollment.findMany({ where: registerWhere(batchId), select: { id: true } })).map((e) => e.id));
  if (marks.some((m) => !allowed.has(m.enrollmentId))) throw new AttendanceError("One of the students isn't in this batch. Refresh the page.", 409);
  await db().$transaction(
    marks.map((m) =>
      m.status
        ? db().attendance.upsert({
            where: { liveClassId_enrollmentId: { liveClassId, enrollmentId: m.enrollmentId } },
            create: { liveClassId, enrollmentId: m.enrollmentId, status: m.status, note: m.note, markedById: actor.id },
            update: { status: m.status, note: m.note, markedById: actor.id, markedAt: new Date() },
          })
        : db().attendance.deleteMany({ where: { liveClassId, enrollmentId: m.enrollmentId } }),
    ),
  );
  const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, marks.filter((m) => m.status === s).length]));
  await audit({ actorId: actor.id, action: "attendance.saved", entityType: "LiveClass", entityId: liveClassId, metadata: { batch: batch.code, class: live.title, ...counts } });
}

/** A student's own marks (liveClassId -> status) and a summary per enrollment, for batches with attendance on. */
export async function studentAttendance(userId: string) {
  const enrollments = await db().enrollment.findMany({
    where: { userId, batch: { attendanceEnabled: true } },
    select: { id: true, batchId: true, attendance: { select: { liveClassId: true, status: true } } },
  });
  const marks = new Map<string, AttendanceStatus>();
  const summary = new Map<string, { attended: number; total: number }>();
  for (const e of enrollments) {
    for (const a of e.attendance) marks.set(a.liveClassId, a.status);
    // Excused classes don't count against the student.
    const counted = e.attendance.filter((a) => a.status !== "EXCUSED");
    summary.set(e.id, { attended: counted.filter((a) => ATTENDED.includes(a.status)).length, total: counted.length });
  }
  return { marks, summary };
}
