/**
 * Student management against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mailer", () => ({ sendMail: async () => {} }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("student management (integration)", async () => {
  const { db } = await import("@/lib/db");
  const students = await import("@/modules/students/service");
  const { manualEnroll } = await import("@/modules/learning/enrollment");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const sa = { id: id("sa"), role: "SUPER_ADMIN" as const };
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const mine = (where: object) => ({ AND: [where, { id: { startsWith: `t${tag}` } }] });
  let published = "";
  let draft = "";

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: id("sa"), name: "Admin", email: `sa.${tag}@example.com`, role: "SUPER_ADMIN" },
        { id: id("cm"), name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: id("s1"), name: "Ayesha Khan", email: `ayesha.${tag}@example.com`, role: "STUDENT", city: "Lahore", phone: "0300 1112223" },
        { id: id("s2"), name: "Bilal Ahmed", email: `bilal.${tag}@example.com`, role: "STUDENT", city: "Faisalabad" },
      ],
    });
    published = (await db().course.create({ data: { slug: `t${tag}-pub`, title: "Published", summary: "Summary text", language: "en", status: "PUBLISHED", createdById: id("sa") } })).id;
    draft = (await db().course.create({ data: { slug: `t${tag}-draft`, title: "Draft", summary: "Summary text", language: "en", createdById: id("sa") } })).id;
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  const names = async (sp: Record<string, string>) =>
    (await db().user.findMany({ where: mine(students.buildStudentWhere(students.parseStudentFilters(sp))), select: { name: true }, orderBy: { name: "asc" } })).map((u) => u.name);

  it("lists only students and filters by search, city, status and enrollment", async () => {
    expect(await names({})).toEqual(["Ayesha Khan", "Bilal Ahmed"]);
    expect(await names({ q: "faisal" })).toEqual(["Bilal Ahmed"]);
    expect(await names({ q: "1112223" })).toEqual(["Ayesha Khan"]);
    expect(students.parseStudentFilters({ status: "DELETED", enrollment: "maybe" })).toEqual({ q: undefined, status: undefined, courseId: undefined, enrollment: undefined });
  });

  it("enrolls manually with the right permissions and rules", async () => {
    await expect(manualEnroll(id("s1"), published, { id: id("x"), role: "INSTRUCTOR" })).rejects.toThrow(/permission/);
    await expect(manualEnroll(id("s1"), draft, cm)).rejects.toThrow(/published or archived/);
    await expect(manualEnroll(id("cm"), published, cm)).rejects.toThrow(/Student not found/);
    await manualEnroll(id("s1"), published, cm);
    await expect(manualEnroll(id("s1"), published, cm)).rejects.toThrow(/already enrolled/);
    const e = await db().enrollment.findFirstOrThrow({ where: { userId: id("s1") } });
    expect(e).toMatchObject({ status: "APPROVED", decidedById: id("cm") });
    expect(await names({ enrollment: "enrolled" })).toEqual(["Ayesha Khan"]);
    expect(await names({ enrollment: "none" })).toEqual(["Bilal Ahmed"]);
    expect(await names({ course: published })).toEqual(["Ayesha Khan"]);
    expect((await students.enrollableCourses(id("s1"))).map((c) => c.id)).not.toContain(published);
  });

  it("lets only Super Admins edit and suspend, and logs which fields changed", async () => {
    const input = { name: "Bilal Ahmed", googleEmail: "bilal.g@gmail.com", phone: null, city: "Faisalabad" };
    await expect(students.updateStudent(id("s2"), input, cm)).rejects.toThrow(/permission/);
    await students.updateStudent(id("s2"), input, sa);
    const log = await db().auditLog.findFirstOrThrow({ where: { entityId: id("s2"), action: "student.updated" } });
    expect(log.metadata).toEqual({ fields: ["googleEmail"] });
    await expect(students.updateStudent(id("sa"), input, sa)).rejects.toThrow(/Student not found/);

    await db().session.create({ data: { id: id("sess"), token: id("tok"), userId: id("s2"), expiresAt: new Date(Date.now() + 86_400_000) } });
    await expect(students.setStudentSuspended(id("s2"), true, "Spam", cm)).rejects.toThrow(/permission/);
    await students.setStudentSuspended(id("s2"), true, "Spam", sa);
    expect(await db().session.count({ where: { userId: id("s2") } })).toBe(0);
    expect(await names({ status: "SUSPENDED" })).toEqual(["Bilal Ahmed"]);
    await expect(manualEnroll(id("s2"), published, sa)).rejects.toThrow(/Reactivate/);
    await students.setStudentSuspended(id("s2"), false, null, sa);
    expect((await db().user.findUniqueOrThrow({ where: { id: id("s2") } })).suspendedReason).toBeNull();
  });

  it("builds a profile with progress and history", async () => {
    const data = (await students.getStudent(id("s1")))!;
    expect(data.enrollments).toHaveLength(1);
    expect(data.enrollments[0]).toMatchObject({ total: 0, done: 0, status: "APPROVED" });
    expect(data.history.map((h) => h.action)).toContain("enrollment.manual");
    expect(await students.getStudent(id("cm"))).toBeNull();
  });
});
