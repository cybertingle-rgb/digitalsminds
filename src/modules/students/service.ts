import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { idsContaining } from "@/lib/text-search";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { deleteFile } from "@/lib/storage/local";
import { receiptKeysOf } from "@/modules/payments/service";

export class StudentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "StudentError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

// ---------------------------------------------------------------------------
// Search and filters
// ---------------------------------------------------------------------------

export type StudentFilters = {
  q?: string;
  status?: "ACTIVE" | "SUSPENDED";
  courseId?: string;
  batchId?: string;
  /** current = confirmed/onboarding/active; none = no current or completed enrollment. */
  enrollment?: "current" | "completed" | "withdrawn" | "none";
};

const CURRENT = ["ENROLLMENT_CONFIRMED", "ONBOARDING", "ACTIVE"] as const;
/** Current students, including enrollments approved before stages existed. */
const currentWhere: Prisma.EnrollmentWhereInput = { OR: [{ stage: { in: [...CURRENT] } }, { stage: null, status: "APPROVED", completedAt: null }] };
const completedWhere: Prisma.EnrollmentWhereInput = { OR: [{ stage: "COMPLETED" }, { stage: null, status: "APPROVED", completedAt: { not: null } }] };

export function parseStudentFilters(sp: Record<string, string | string[] | undefined>): StudentFilters {
  const one = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    q: one(sp.q).slice(0, 100) || undefined,
    status: (["ACTIVE", "SUSPENDED"] as const).find((s) => s === sp.status),
    courseId: one(sp.course).slice(0, 64) || undefined,
    batchId: one(sp.batch).slice(0, 64) || undefined,
    enrollment: (["current", "completed", "withdrawn", "none"] as const).find((s) => s === sp.enrollment),
  };
}

export async function buildStudentWhere(f: StudentFilters): Promise<Prisma.UserWhereInput> {
  const and: Prisma.UserWhereInput[] = [{ role: "STUDENT" }];
  if (f.q) {
    and.push({ id: { in: await idsContaining("User", ["name", "email", "googleEmail", "phone", "city"], f.q) } });
  }
  if (f.status) and.push({ status: f.status });
  if (f.courseId) and.push({ enrollments: { some: { courseId: f.courseId } } });
  if (f.batchId) and.push({ enrollments: { some: { batchId: f.batchId } } });
  if (f.enrollment === "current") and.push({ enrollments: { some: currentWhere } });
  if (f.enrollment === "completed") and.push({ enrollments: { some: completedWhere } });
  if (f.enrollment === "withdrawn") and.push({ enrollments: { some: { stage: "WITHDRAWN" } } });
  if (f.enrollment === "none") and.push({ enrollments: { none: { OR: [currentWhere, completedWhere] } } });
  return { AND: and };
}

const listInclude = {
  enrollments: { select: { status: true, stage: true, completedAt: true, course: { select: { title: true } }, batch: { select: { code: true } } } },
  sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
} satisfies Prisma.UserInclude;

export async function listStudents(f: StudentFilters, page: number, pageSize: number) {
  const where = await buildStudentWhere(f);
  const [items, total] = await Promise.all([
    db().user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: listInclude }),
    db().user.count({ where }),
  ]);
  return { items: items.map(summarise), total };
}

function summarise(u: Prisma.UserGetPayload<{ include: typeof listInclude }>) {
  const { enrollments, sessions, ...user } = u;
  return {
    ...user,
    enrolled: enrollments
      .filter((e) => (e.stage ? (CURRENT as readonly string[]).includes(e.stage) : e.status === "APPROVED" && !e.completedAt))
      .map((e) => (e.batch ? `${e.course.title} (${e.batch.code})` : e.course.title)),
    completed: enrollments.filter((e) => e.stage === "COMPLETED" || (!e.stage && e.status === "APPROVED" && e.completedAt)).map((e) => e.course.title),
    withdrawn: enrollments.filter((e) => e.stage === "WITHDRAWN").map((e) => e.course.title),
    lastActive: sessions[0]?.updatedAt ?? null,
  };
}

/** Every matching student, for the CSV export (capped to keep memory bounded). */
export async function studentsForExport(f: StudentFilters) {
  const rows = await db().user.findMany({ where: await buildStudentWhere(f), orderBy: { createdAt: "desc" }, take: 20_000, include: listInclude });
  return rows.map(summarise);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getStudent(id: string) {
  const user = await db().user.findFirst({
    where: { id, role: "STUDENT" },
    include: {
      accounts: { select: { providerId: true } },
      sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          decidedBy: { select: { name: true } },
          course: { select: { id: true, title: true, slug: true, status: true } },
          batch: { select: { id: true, name: true, code: true, startDate: true } },
          events: { orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } },
        },
      },
    },
  });
  if (!user) return null;
  const [applications, history] = await Promise.all([
    db().enrollmentApplication.findMany({
      where: { OR: [{ userId: id }, { email: user.email }] },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, stage: true, createdAt: true, course: { select: { title: true } }, batch: { select: { name: true } }, payments: { select: { status: true, amount: true, amountReceived: true } } },
    }),
    db().auditLog.findMany({
      where: { OR: [{ entityType: "User", entityId: id }, { entityType: "Enrollment", entityId: { in: user.enrollments.map((e) => e.id) } }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true } } },
    }),
  ]);
  return {
    user: { ...user, enrollments: undefined, sessions: undefined, accounts: undefined },
    signIn: [...new Set(user.accounts.map((a) => (a.providerId === "credential" ? "Email & password" : a.providerId === "google" ? "Google" : a.providerId)))],
    lastActive: user.sessions[0]?.updatedAt ?? null,
    enrollments: user.enrollments,
    applications,
    history,
  };
}

export const studentEditInput = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  googleEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.union([z.literal(""), z.email("Enter a valid email address")]))
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^([+()\-\s\d]{6,40})?$/, "Enter a valid phone number")
    .transform((v) => v || null),
  city: z.string().trim().max(80).transform((v) => v || null),
});

async function requireStudent(id: string) {
  const user = await db().user.findFirst({ where: { id, role: "STUDENT" } });
  if (!user) throw new StudentError("Student not found.", 404);
  return user;
}

/** Fix a student's details (e.g. a mistyped Google email). Super Admin only. */
export async function updateStudent(id: string, input: z.infer<typeof studentEditInput>, actor: Actor) {
  if (!can(actor.role, "students.manage")) throw new StudentError("You don't have permission to do that.", 403);
  const before = await requireStudent(id);
  const changed = (Object.keys(input) as (keyof typeof input)[]).filter((k) => (before[k] ?? null) !== input[k]);
  if (changed.length === 0) return;
  await db().user.update({ where: { id }, data: input });
  // Record which fields changed, not the personal data itself.
  await audit({ actorId: actor.id, action: "student.updated", entityType: "User", entityId: id, metadata: { fields: changed } });
}

/** Suspend (signs the student out everywhere and blocks sign-in) or reactivate. Super Admin only. */
export async function setStudentSuspended(id: string, suspended: boolean, reason: string | null, actor: Actor) {
  if (!can(actor.role, "students.manage")) throw new StudentError("You don't have permission to do that.", 403);
  const user = await requireStudent(id);
  if ((user.status === "SUSPENDED") === suspended) return;
  await db().$transaction([
    db().user.update({
      where: { id },
      data: suspended
        ? { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason?.slice(0, 500) || null }
        : { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
    }),
    ...(suspended ? [db().session.deleteMany({ where: { userId: id } })] : []),
  ]);
  await audit({ actorId: actor.id, action: suspended ? "user.suspend" : "user.reactivate", entityType: "User", entityId: id, metadata: reason ? { reason } : undefined });
}

/**
 * Permanently deletes a student account for a privacy request: profile,
 * sign-in methods, sessions, enrollments, certificates, support requests and
 * notifications (all cascade), their applications (with CNIC, CV and payment
 * receipts), plus a newsletter record with the same email. Super Admin only;
 * the email must be typed to confirm.
 */
export async function deleteStudent(id: string, confirmEmail: string, actor: Actor) {
  if (!can(actor.role, "students.delete")) throw new StudentError("Only Super Admins can delete accounts.", 403);
  const user = await requireStudent(id);
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) throw new StudentError("Type the student's email address exactly to confirm.");
  // Applications hold the CNIC and CV, so they go too (matched by account or email).
  const applications = await db().enrollmentApplication.findMany({
    where: { OR: [{ userId: id }, { email: user.email }] },
    select: { id: true, cvKey: true, payments: { select: { receiptKey: true } } },
  });
  const appIds = applications.map((a) => a.id);
  const [enrollments, certificates, receipts] = await Promise.all([db().enrollment.count({ where: { userId: id } }), db().certificate.count({ where: { userId: id } }), receiptKeysOf(id)]);
  await db().$transaction([
    db().payment.deleteMany({ where: { applicationId: { in: appIds } } }),
    db().enrollmentApplication.deleteMany({ where: { id: { in: appIds } } }),
    db().newsletterSubscriber.deleteMany({ where: { email: user.email } }),
    db().user.delete({ where: { id } }),
  ]);
  // Receipts and CVs are files, not rows: remove them too (payments themselves cascade).
  const files = [...receipts, ...applications.flatMap((a) => [a.cvKey, ...a.payments.map((p) => p.receiptKey)]).filter((k): k is string => !!k)];
  await Promise.all([...new Set(files)].map((key) => deleteFile(key).catch(() => {})));
  // No personal details in the log, only what was removed.
  await audit({ actorId: actor.id, action: "student.deleted", entityType: "User", entityId: id, metadata: { enrollments, certificates, applications: appIds.length } });
}

/**
 * Student accounts from the old free sign-up: active, never enrolled through
 * a verified payment (no staged enrollment, no confirmed payment, no
 * application). Under the paid-enrollment model they shouldn't have access.
 */
export const legacyAccountsWhere: Prisma.UserWhereInput = {
  role: "STUDENT",
  status: "ACTIVE",
  enrollments: { none: { stage: { not: null } } },
  payments: { none: { status: "CONFIRMED" } },
  applications: { none: {} },
};

export async function legacyAccounts(take = 20) {
  const [count, sample] = await Promise.all([
    db().user.count({ where: legacyAccountsWhere }),
    db().user.findMany({ where: legacyAccountsWhere, orderBy: { createdAt: "asc" }, take, select: { id: true, name: true, email: true, createdAt: true } }),
  ]);
  return { count, sample };
}

/**
 * Suspends every legacy account (signs them out; reversible per student).
 * `expected` must match the count the Super Admin was shown, so a different
 * set is never suspended by mistake.
 */
export async function suspendLegacyAccounts(expected: number, actor: Actor) {
  if (!can(actor.role, "students.manage")) throw new StudentError("Only Super Admins can do that.", 403);
  const ids = (await db().user.findMany({ where: legacyAccountsWhere, select: { id: true } })).map((u) => u.id);
  if (ids.length !== expected) throw new StudentError(`The number of accounts changed (now ${ids.length}). Refresh the page and check again.`, 409);
  if (!ids.length) return 0;
  const reason = "Free sign-up closed: accounts are now created after a verified enrollment payment.";
  await db().$transaction([
    db().user.updateMany({ where: { id: { in: ids }, ...legacyAccountsWhere }, data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason } }),
    db().session.deleteMany({ where: { userId: { in: ids } } }),
  ]);
  await audit({ actorId: actor.id, action: "students.legacy_suspended", entityType: "User", metadata: { count: ids.length } });
  return ids.length;
}

export function inquiriesFromEmail(email: string) {
  return db().inquiry.count({ where: { email } });
}
