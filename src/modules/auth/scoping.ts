import "server-only";
import { db } from "@/lib/db";
import { can } from "./permissions";
import type { CurrentUser } from "./session";

/**
 * Course-level authorisation: Super Admins and Content Managers can manage
 * every course; Instructors only the courses they are assigned to.
 */
export async function canManageCourse(user: Pick<CurrentUser, "id" | "role">, courseId: string): Promise<boolean> {
  if (can(user.role, "courses.manage.all")) return true;
  if (!can(user.role, "courses.manage.own")) return false;
  const assignment = await db().courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  return !!assignment;
}

/** Prisma `where` filter for the courses a user may see in the admin course list. */
export function manageableCoursesWhere(user: Pick<CurrentUser, "id" | "role">) {
  if (can(user.role, "courses.manage.all")) return {};
  if (can(user.role, "courses.manage.own")) return { instructors: { some: { userId: user.id } } };
  return { id: "__none__" };
}
