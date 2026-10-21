/**
 * Role-based permissions. Every admin page, server action and API route checks
 * a permission on the server; hiding a button is never the only protection.
 * Anything not listed for a role is denied.
 */

export const roles = ["SUPER_ADMIN", "CONTENT_MANAGER", "INSTRUCTOR", "STUDENT"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "admin.access",
  "integrations.manage",
  "settings.manage",
  "staff.manage",
  "audit.view",
  "students.view",
  "students.manage",
  "students.export",
  "students.delete",
  "enrollments.decide",
  "courses.manage.all",
  "courses.manage.own",
  "courses.publish",
  "content.manage",
  "inquiries.manage",
  "inquiries.export",
  "inquiries.delete",
  "media.manage.all",
  "media.manage.own",
  "support.manage.all",
  "support.manage.own",
  "certificates.issue",
  "announcements.site",
  "newsletter.view",
  "newsletter.export",
  "newsletter.delete",
  "backups.download",
  /** See payments waiting and their status. */
  "payments.view",
  /** Confirm or reject payments, set course prices and payment account details. */
  "payments.manage",
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: permissions,
  CONTENT_MANAGER: [
    "admin.access",
    "students.view",
    "enrollments.decide",
    "courses.manage.all",
    "courses.publish",
    "content.manage",
    "inquiries.manage",
    "media.manage.all",
    "support.manage.all",
    "certificates.issue",
    "announcements.site",
    "newsletter.view",
    "payments.view",
  ],
  // Instructors are further limited to their own courses (CourseInstructor) in later phases.
  INSTRUCTOR: ["admin.access", "courses.manage.own", "media.manage.own", "support.manage.own"],
  STUDENT: [],
};

export function can(role: Role | string | null | undefined, permission: Permission): boolean {
  if (!role || !Object.hasOwn(grants, role)) return false;
  return grants[role as Role].includes(permission);
}

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  CONTENT_MANAGER: "Content Manager",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
};
