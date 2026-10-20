import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";

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
  enrollment?: "enrolled" | "waiting" | "none";
};

export function parseStudentFilters(sp: Record<string, string | string[] | undefined>): StudentFilters {
  const one = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    q: one(sp.q).slice(0, 100) || undefined,
    status: (["ACTIVE", "SUSPENDED"] as const).find((s) => s === sp.status),
    courseId: one(sp.course).slice(0, 64) || undefined,
    enrollment: (["enrolled", "waiting", "none"] as const).find((s) => s === sp.enrollment),
  };
}

export function buildStudentWhere(f: StudentFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ role: "STUDENT" }];
  if (f.q) {
    and.push({ OR: [{ name: { contains: f.q } }, { email: { contains: f.q } }, { googleEmail: { contains: f.q } }, { phone: { contains: f.q } }, { city: { contains: f.q } }] });
  }
  if (f.status) and.push({ status: f.status });
  if (f.courseId) and.push({ enrollments: { some: { courseId: f.courseId, status: "APPROVED" } } });
  if (f.enrollment === "enrolled") and.push({ enrollments: { some: { status: "APPROVED" } } });
  if (f.enrollment === "waiting") and.push({ enrollments: { some: { status: "REQUESTED" } } });
  if (f.enrollment === "none") and.push({ enrollments: { none: { status: { in: ["APPROVED", "REQUESTED"] } } } });
  return { AND: and };
}

const listInclude = {
  enrollments: { select: { status: true, completedAt: true, course: { select: { title: true } } } },
  sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
} satisfies Prisma.UserInclude;

export async function listStudents(f: StudentFilters, page: number, pageSize: number) {
  const where = buildStudentWhere(f);
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
    enrolled: enrollments.filter((e) => e.status === "APPROVED").map((e) => e.course.title),
    waiting: enrollments.filter((e) => e.status === "REQUESTED").map((e) => e.course.title),
    completed: enrollments.filter((e) => e.completedAt).map((e) => e.course.title),
    lastActive: sessions[0]?.updatedAt ?? null,
  };
}

/** Every matching student, for the CSV export (capped to keep memory bounded). */
export async function studentsForExport(f: StudentFilters) {
  const rows = await db().user.findMany({ where: buildStudentWhere(f), orderBy: { createdAt: "desc" }, take: 20_000, include: listInclude });
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
        orderBy: { requestedAt: "desc" },
        include: {
          decidedBy: { select: { name: true } },
          course: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              modules: { orderBy: { position: "asc" }, select: { lessons: { orderBy: { position: "asc" }, select: { id: true, title: true } } } },
            },
          },
        },
      },
    },
  });
  if (!user) return null;
  const lessonIds = user.enrollments.flatMap((e) => e.course.modules.flatMap((m) => m.lessons.map((l) => l.id)));
  const [progress, history] = await Promise.all([
    lessonIds.length ? db().lessonProgress.findMany({ where: { userId: id, lessonId: { in: lessonIds } }, orderBy: { lastViewedAt: "desc" } }) : [],
    db().auditLog.findMany({
      where: { OR: [{ entityType: "User", entityId: id }, { entityType: "Enrollment", entityId: { in: user.enrollments.map((e) => e.id) } }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true } } },
    }),
  ]);
  const enrollments = user.enrollments.map((e) => {
    const lessons = e.course.modules.flatMap((m) => m.lessons);
    const ids = new Set(lessons.map((l) => l.id));
    const mine = progress.filter((p) => ids.has(p.lessonId));
    const last = mine[0];
    return {
      ...e,
      total: lessons.length,
      done: mine.filter((p) => p.completedAt).length,
      lastViewed: last ? { at: last.lastViewedAt, title: lessons.find((l) => l.id === last.lessonId)?.title ?? "" } : null,
    };
  });
  return {
    user: { ...user, enrollments: undefined, sessions: undefined, accounts: undefined },
    signIn: [...new Set(user.accounts.map((a) => (a.providerId === "credential" ? "Email & password" : a.providerId === "google" ? "Google" : a.providerId)))],
    lastActive: user.sessions[0]?.updatedAt ?? null,
    enrollments,
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

/** Courses a student could be enrolled in by staff (not drafts, not already enrolled). */
export async function enrollableCourses(studentId: string) {
  return db().course.findMany({
    where: { status: { not: "DRAFT" }, enrollments: { none: { userId: studentId, status: "APPROVED" } } },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: { id: true, title: true, status: true },
  });
}

/**
 * Permanently deletes a student account for a privacy request: profile,
 * sign-in methods, sessions, enrollments, progress, certificates, support
 * requests and notifications (all cascade), plus a newsletter record with the
 * same email. Super Admin only; the email must be typed to confirm.
 */
export async function deleteStudent(id: string, confirmEmail: string, actor: Actor) {
  if (!can(actor.role, "students.delete")) throw new StudentError("Only Super Admins can delete accounts.", 403);
  const user = await requireStudent(id);
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) throw new StudentError("Type the student's email address exactly to confirm.");
  const [enrollments, certificates] = await Promise.all([db().enrollment.count({ where: { userId: id } }), db().certificate.count({ where: { userId: id } })]);
  await db().$transaction([
    db().newsletterSubscriber.deleteMany({ where: { email: user.email } }),
    db().user.delete({ where: { id } }),
  ]);
  // No personal details in the log, only what was removed.
  await audit({ actorId: actor.id, action: "student.deleted", entityType: "User", entityId: id, metadata: { enrollments, certificates } });
}

export function inquiriesFromEmail(email: string) {
  return db().inquiry.count({ where: { email } });
}
