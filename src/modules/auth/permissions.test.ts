import { describe, expect, it } from "vitest";
import { can, permissions } from "./permissions";

describe("can", () => {
  it("gives Super Admin every permission", () => {
    for (const p of permissions) expect(can("SUPER_ADMIN", p)).toBe(true);
  });

  it("gives students no admin permissions", () => {
    for (const p of permissions) expect(can("STUDENT", p)).toBe(false);
  });

  it("keeps integrations, settings, staff and exports Super Admin only", () => {
    for (const role of ["CONTENT_MANAGER", "INSTRUCTOR", "STUDENT"]) {
      for (const p of ["integrations.manage", "settings.manage", "staff.manage", "students.export", "inquiries.export", "inquiries.delete", "newsletter.export"] as const) {
        expect(can(role, p)).toBe(false);
      }
    }
  });

  it("limits instructors to their own courses", () => {
    expect(can("INSTRUCTOR", "courses.manage.own")).toBe(true);
    expect(can("INSTRUCTOR", "courses.manage.all")).toBe(false);
    expect(can("INSTRUCTOR", "enrollments.decide")).toBe(false);
    expect(can("INSTRUCTOR", "media.manage.own")).toBe(true);
    expect(can("INSTRUCTOR", "media.manage.all")).toBe(false);
    expect(can("INSTRUCTOR", "courses.publish")).toBe(false);
    expect(can("CONTENT_MANAGER", "courses.publish")).toBe(true);
  });

  it("scopes support, certificates and announcements", () => {
    expect(can("CONTENT_MANAGER", "support.manage.all")).toBe(true);
    expect(can("INSTRUCTOR", "support.manage.all")).toBe(false);
    expect(can("INSTRUCTOR", "support.manage.own")).toBe(true);
    expect(can("CONTENT_MANAGER", "certificates.issue")).toBe(true);
    expect(can("INSTRUCTOR", "certificates.issue")).toBe(false);
    expect(can("INSTRUCTOR", "announcements.site")).toBe(false);
    expect(can("CONTENT_MANAGER", "newsletter.view")).toBe(true);
  });

  it("denies unknown or missing roles", () => {
    expect(can(undefined, "admin.access")).toBe(false);
    expect(can("HACKER", "admin.access")).toBe(false);
    expect(can("toString", "admin.access")).toBe(false);
  });
});
