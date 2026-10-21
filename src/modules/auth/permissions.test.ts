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

  it("limits batch coordinators to their own batches", () => {
    expect(can("INSTRUCTOR", "batches.coordinate")).toBe(true);
    expect(can("INSTRUCTOR", "batches.manage")).toBe(false);
    expect(can("INSTRUCTOR", "applications.view")).toBe(false);
    expect(can("INSTRUCTOR", "courses.manage.own")).toBe(false);
    expect(can("INSTRUCTOR", "courses.manage.all")).toBe(false);
    expect(can("INSTRUCTOR", "enrollments.decide")).toBe(false);
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

  it("keeps payment verification, sensitive applicant data and transfers Super Admin only", () => {
    for (const role of ["CONTENT_MANAGER", "INSTRUCTOR", "STUDENT"]) {
      for (const p of ["payments.manage", "applications.sensitive", "enrollments.admin"] as const) expect(can(role, p)).toBe(false);
    }
    expect(can("CONTENT_MANAGER", "applications.view")).toBe(true);
    expect(can("CONTENT_MANAGER", "batches.manage")).toBe(true);
  });

  it("denies unknown or missing roles", () => {
    expect(can(undefined, "admin.access")).toBe(false);
    expect(can("HACKER", "admin.access")).toBe(false);
    expect(can("toString", "admin.access")).toBe(false);
  });
});
