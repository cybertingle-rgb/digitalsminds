import "server-only";
import { z } from "zod";
import type { BatchStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { meetingUrlSchema } from "@/lib/meeting-url";
import { pkDay } from "@/lib/pk-time";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { availability, dateOnly, PUBLIC_BATCH_STATUSES, SEAT_STAGES, seatsLeft } from "./rules";

/**
 * Batches: intakes of a program with their own dates, schedule and seats.
 * Super Admins and Content Managers manage them; coordinators see the ones
 * assigned to them.
 */

export class BatchError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "BatchError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

export const BATCH_STATUSES = ["DRAFT", "OPEN", "CLOSED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const satisfies readonly BatchStatus[];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const optionalDay = z.preprocess((v) => (v === "" || v == null ? undefined : v), day.optional());
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const batchInput = z
  .object({
    courseId: z.string().min(1, "Choose a program").max(64),
    name: z.string().trim().min(3, "Enter a name").max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{1,31}$/, "Use 2-32 letters, numbers or dashes, e.g. EBAY-07"),
    status: z.enum(BATCH_STATUSES),
    startDate: day,
    endDate: optionalDay,
    applicationDeadline: optionalDay,
    scheduleText: z.string().trim().min(3, "Describe the class days and times").max(300),
    capacity: z.coerce.number().int("Whole number").min(1, "At least 1 seat").max(2000, "At most 2000 seats"),
    meetingUrl: z.preprocess((v) => (v === "" || v == null ? undefined : v), meetingUrlSchema.optional()),
    joiningInfo: optionalText(5000),
    internalNotes: optionalText(5000),
    coordinatorId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().max(64).optional()),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "Ends before it starts" })
  .refine((v) => !v.applicationDeadline || v.applicationDeadline <= (v.endDate ?? v.startDate), {
    path: ["applicationDeadline"],
    message: "The deadline must be before the batch ends",
  });
export type BatchInput = z.infer<typeof batchInput>;

function assertCanManage(actor: Actor) {
  if (!can(actor.role, "batches.manage")) throw new BatchError("You don't have permission to manage batches.", 403);
}

async function checkReferences(input: BatchInput, excludeId?: string) {
  const [course, clash, coordinator] = await Promise.all([
    db().course.findUnique({ where: { id: input.courseId }, select: { id: true, title: true } }),
    db().batch.findFirst({ where: { code: input.code, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }),
    input.coordinatorId ? db().user.findUnique({ where: { id: input.coordinatorId }, select: { role: true, status: true } }) : null,
  ]);
  if (!course) throw new BatchError("Program not found.", 404);
  if (clash) throw new BatchError("Another batch already uses this code.", 409);
  if (input.coordinatorId && (!coordinator || coordinator.role === "STUDENT" || coordinator.status !== "ACTIVE")) {
    throw new BatchError("The coordinator must be an active team member.");
  }
  return course;
}

function toData(input: BatchInput) {
  return {
    courseId: input.courseId,
    name: input.name,
    code: input.code,
    status: input.status,
    startDate: dateOnly(input.startDate),
    endDate: input.endDate ? dateOnly(input.endDate) : null,
    applicationDeadline: input.applicationDeadline ? dateOnly(input.applicationDeadline) : null,
    scheduleText: input.scheduleText,
    capacity: input.capacity,
    meetingUrl: input.meetingUrl ?? null,
    joiningInfo: input.joiningInfo,
    internalNotes: input.internalNotes,
    coordinatorId: input.coordinatorId ?? null,
  };
}

export async function createBatch(input: BatchInput, actor: Actor) {
  assertCanManage(actor);
  const course = await checkReferences(input);
  const batch = await db().batch.create({ data: toData(input) });
  await audit({ actorId: actor.id, action: "batch.created", entityType: "Batch", entityId: batch.id, metadata: { code: batch.code, program: course.title } });
  return batch;
}

export async function updateBatch(id: string, input: BatchInput, actor: Actor) {
  assertCanManage(actor);
  const existing = await db().batch.findUnique({ where: { id }, select: { courseId: true, capacity: true, status: true } });
  if (!existing) throw new BatchError("Batch not found.", 404);
  if (existing.courseId !== input.courseId && (await db().enrollmentApplication.count({ where: { batchId: id } }))) {
    throw new BatchError("This batch already has applications, so its program can't change.");
  }
  const taken = (await seatsTaken([id])).get(id) ?? 0;
  if (input.capacity < taken) throw new BatchError(`${taken} seats are already taken; capacity can't be lower than that.`);
  await checkReferences(input, id);
  const batch = await db().batch.update({ where: { id }, data: toData(input) });
  await audit({
    actorId: actor.id,
    action: "batch.updated",
    entityType: "Batch",
    entityId: id,
    metadata: { code: batch.code, ...(existing.status !== batch.status && { status: `${existing.status} → ${batch.status}` }), ...(existing.capacity !== batch.capacity && { capacity: `${existing.capacity} → ${batch.capacity}` }) },
  });
  return batch;
}

/** Seats taken per batch (students whose payment was verified and who haven't withdrawn). */
export async function seatsTaken(batchIds: string[]): Promise<Map<string, number>> {
  if (!batchIds.length) return new Map();
  const rows = await db().enrollment.groupBy({
    by: ["batchId"],
    where: { batchId: { in: batchIds }, stage: { in: [...SEAT_STAGES] } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.batchId!, r._count._all]));
}

export type BatchFilter = { courseId?: string; status?: BatchStatus; scope?: "coordinator" };

/** Batches for the admin list; coordinators only see the ones assigned to them. */
export async function listBatches(actor: Actor, f: BatchFilter = {}) {
  const where: Prisma.BatchWhereInput = {
    ...(f.courseId ? { courseId: f.courseId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(!can(actor.role, "batches.manage") ? { coordinatorId: actor.id } : {}),
  };
  const batches = await db().batch.findMany({
    where,
    orderBy: [{ startDate: "desc" }],
    take: 300,
    include: {
      course: { select: { id: true, title: true, slug: true } },
      coordinator: { select: { name: true } },
      _count: { select: { applications: { where: { stage: { in: ["APPLICATION_RECEIVED", "PAYMENT_PENDING", "PAYMENT_SUBMITTED"] } } } } },
    },
  });
  const taken = await seatsTaken(batches.map((b) => b.id));
  const today = pkDay();
  return batches.map((b) => ({ ...b, taken: taken.get(b.id) ?? 0, open: availability(b, taken.get(b.id) ?? 0, today) }));
}

/** A batch the actor may see (managers: any; coordinators: their own). */
export async function getBatch(id: string, actor: Actor) {
  const batch = await db().batch.findUnique({
    where: { id },
    include: { course: { select: { id: true, title: true, slug: true, priceAmount: true, accessType: true } }, coordinator: { select: { id: true, name: true } } },
  });
  if (!batch) return null;
  if (!can(actor.role, "batches.manage") && batch.coordinatorId !== actor.id) return null;
  const taken = (await seatsTaken([id])).get(id) ?? 0;
  return { ...batch, taken, open: availability(batch, taken, pkDay()) };
}

/** Whether the actor can work with a batch's students (roster, schedule, notices). */
export async function canCoordinate(actor: Actor, batchId: string) {
  if (can(actor.role, "batches.manage")) return true;
  if (!can(actor.role, "batches.coordinate")) return false;
  const b = await db().batch.findUnique({ where: { id: batchId }, select: { coordinatorId: true } });
  return b?.coordinatorId === actor.id;
}

/** Team members who can be made coordinators. */
export function coordinatorOptions() {
  return db().user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "CONTENT_MANAGER", "INSTRUCTOR"] }, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}

/** Batches shown on a public program page, with seats left and whether they take applications. */
export async function publicBatches(courseId: string) {
  const batches = await db().batch.findMany({
    where: { courseId, status: { in: [...PUBLIC_BATCH_STATUSES] } },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true, scheduleText: true, capacity: true, applicationDeadline: true },
  });
  const taken = await seatsTaken(batches.map((b) => b.id));
  const today = pkDay();
  return batches.map((b) => {
    const t = taken.get(b.id) ?? 0;
    return { ...b, seatsLeft: seatsLeft(b.capacity, t), open: availability(b, t, today) };
  });
}

/** Earliest open batch start per program (catalogue cards). */
export async function nextOpenBatchByCourse(courseIds: string[]) {
  if (!courseIds.length) return new Map<string, Date>();
  const batches = await db().batch.findMany({
    where: { courseId: { in: courseIds }, status: "OPEN" },
    orderBy: { startDate: "asc" },
    select: { id: true, courseId: true, startDate: true, capacity: true, status: true, applicationDeadline: true },
  });
  const taken = await seatsTaken(batches.map((b) => b.id));
  const today = pkDay();
  const out = new Map<string, Date>();
  for (const b of batches) if (!out.has(b.courseId) && availability(b, taken.get(b.id) ?? 0, today) === "open") out.set(b.courseId, b.startDate);
  return out;
}
