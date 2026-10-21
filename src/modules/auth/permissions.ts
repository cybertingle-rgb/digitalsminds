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
  /** Verify or reject payments (which activates student accounts), set fees and payment account details. */
  "payments.manage",
  /** Create and edit batches (dates, schedule, seats, joining details). */
  "batches.manage",
  /** See enrollment applications (without CNIC and CV). */
  "applications.view",
  /** See applicants' CNIC numbers and CVs. */
  "applications.sensitive",
  /** Transfer students between batches, withdraw them, or cancel/reject applications. */
  "enrollments.admin",
  /** Onboarding checklists and student documents. */
  "onboarding.manage",
  /** Coordinators: roster, schedule and notices of the batches assigned to them. */
  "batches.coordinate",
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
    "batches.manage",
    "applications.view",
    "onboarding.manage",
  ],
  // Batch coordinators: only the batches assigned to them (Batch.coordinatorId).
  INSTRUCTOR: ["admin.access", "batches.coordinate", "support.manage.own"],
  STUDENT: [],
};

export function can(role: Role | string | null | undefined, permission: Permission): boolean {
  if (!role || !Object.hasOwn(grants, role)) return false;
  return grants[role as Role].includes(permission);
}

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  CONTENT_MANAGER: "Content Manager",
  INSTRUCTOR: "Batch Coordinator",
  STUDENT: "Student",
};
