import "server-only";
import { db } from "@/lib/db";
import { pkTodayRange } from "@/lib/pk-time";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { mediaScope } from "@/modules/media/service";
import { supportScope } from "@/modules/support/service";
import { readyToIssue } from "@/modules/certificates/service";

const DAY = 24 * 60 * 60 * 1000;
const OPEN = ["NEW", "CONTACTED", "QUALIFIED"] as const;

/** Dashboard numbers, each a live query, and only the ones this user may see. */
export async function dashboardStats(user: Pick<CurrentUser, "id" | "role">) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const { end: endOfToday } = pkTodayRange(now);

  const leads = can(user.role, "inquiries.manage")
    ? await Promise.all([
        db().inquiry.count({ where: { createdAt: { gte: weekAgo }, status: { not: "SPAM" } } }),
        db().inquiry.count({ where: { status: "NEW" } }),
        db().inquiry.count({ where: { status: { in: [...OPEN] }, followUpAt: { lt: endOfToday } } }),
        db().inquiry.groupBy({ by: ["service"], where: { createdAt: { gte: monthAgo }, status: { not: "SPAM" } }, _count: { _all: true } }),
        db().inquiry.findMany({
          where: { status: { not: "SPAM" } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, name: true, service: true, status: true, createdAt: true },
        }),
      ]).then(([lastWeek, unanswered, followUpsDue, byService, recent]) => ({
        lastWeek,
        unanswered,
        followUpsDue,
        byService: byService.map((r) => ({ service: r.service, count: r._count._all })).sort((a, b) => b.count - a.count),
        recent,
      }))
    : null;

  const people = can(user.role, "students.view")
    ? await Promise.all([
        db().user.count({ where: { role: "STUDENT" } }),
        db().user.count({ where: { role: "STUDENT", createdAt: { gte: weekAgo } } }),
        db().user.count({ where: { role: { in: ["SUPER_ADMIN", "CONTENT_MANAGER", "INSTRUCTOR"] }, status: "ACTIVE" } }),
      ]).then(([students, newStudents, staff]) => ({ students, newStudents, staff }))
    : null;

  const media =
    can(user.role, "media.manage.all") || can(user.role, "media.manage.own")
      ? await db()
          .mediaAsset.aggregate({ where: mediaScope(user), _count: { _all: true }, _sum: { sizeBytes: true } })
          .then((r) => ({ files: r._count._all, bytes: r._sum.sizeBytes ?? 0 }))
      : null;

  const learning = can(user.role, "enrollments.decide")
    ? await Promise.all([
        db().enrollment.count({ where: { status: "REQUESTED" } }),
        db().enrollment.count({ where: { status: "APPROVED" } }),
        db().course.count({ where: { status: "PUBLISHED" } }),
      ]).then(([waiting, enrolled, published]) => ({ waiting, enrolled, published }))
    : null;

  const support =
    can(user.role, "support.manage.all") || can(user.role, "support.manage.own")
      ? await db().supportTicket.count({ where: { AND: [supportScope(user), { status: "OPEN" }] } })
      : null;

  const certificatesReady = can(user.role, "certificates.issue") ? (await readyToIssue()).length : null;

  const activity = can(user.role, "audit.view")
    ? await db().auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { actor: { select: { name: true } } } })
    : null;

  return { leads, people, media, learning, support, certificatesReady, activity };
}
