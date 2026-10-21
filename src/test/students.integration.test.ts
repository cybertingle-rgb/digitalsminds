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
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const sa = { id: id("sa"), role: "SUPER_ADMIN" as const };
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const mine = (where: object) => ({ AND: [where, { id: { startsWith: `t${tag}` } }] });
  let published = "";
  let batch = "";

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
    batch = (await db().batch.create({ data: { courseId: published, name: "Batch 1", code: `S${tag}`.toUpperCase(), status: "OPEN", startDate: new Date(), scheduleText: "Mon", capacity: 5 } })).id;
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollmentApplication.deleteMany({ where: { courseId: published } });
    await db().batch.deleteMany({ where: { id: batch } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  const names = async (sp: Record<string, string>) =>
    (await db().user.findMany({ where: mine(await students.buildStudentWhere(students.parseStudentFilters(sp))), select: { name: true }, orderBy: { name: "asc" } })).map((u) => u.name);

  it("lists only students and filters by search, city, status and enrollment", async () => {
    expect(await names({})).toEqual(["Ayesha Khan", "Bilal Ahmed"]);
    expect(await names({ q: "faisal" })).toEqual(["Bilal Ahmed"]);
    expect(await names({ q: "1112223" })).toEqual(["Ayesha Khan"]);
    expect(students.parseStudentFilters({ status: "DELETED", enrollment: "maybe" })).toEqual({ q: undefined, status: undefined, courseId: undefined, batchId: undefined, enrollment: undefined });
  });

  it("filters by enrollment stage, program and batch", async () => {
    const e = await db().enrollment.create({ data: { userId: id("s1"), courseId: published, batchId: batch, status: "APPROVED", stage: "ACTIVE" } });
    await db().enrollmentEvent.create({ data: { enrollmentId: e.id, stage: "ACTIVE", actorId: id("sa") } });
    await db().enrollmentApplication.create({
      data: { reference: `DM-${tag.slice(0, 4).toUpperCase()}`, courseId: published, batchId: batch, name: "Ayesha Khan", email: `ayesha.${tag}@example.com`, phone: "0300", city: "Lahore", cnic: "35202-1234567-1", cvKey: `applications/cv/${tag}.pdf`, feeAmount: 100, tokenHash: tag.padEnd(64, "0"), termsAcceptedAt: new Date(), userId: id("s1"), stage: "ENROLLMENT_CONFIRMED" },
    });
    expect(await names({ enrollment: "current" })).toEqual(["Ayesha Khan"]);
    expect(await names({ enrollment: "none" })).toEqual(["Bilal Ahmed"]);
    expect(await names({ enrollment: "completed" })).toEqual([]);
    expect(await names({ course: published })).toEqual(["Ayesha Khan"]);
    expect(await names({ batch })).toEqual(["Ayesha Khan"]);
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
    await students.setStudentSuspended(id("s2"), false, null, sa);
    expect((await db().user.findUniqueOrThrow({ where: { id: id("s2") } })).suspendedReason).toBeNull();
  });

  it("builds a profile with enrollments, applications and history", async () => {
    const data = (await students.getStudent(id("s1")))!;
    expect(data.enrollments).toHaveLength(1);
    expect(data.enrollments[0]).toMatchObject({ stage: "ACTIVE", batch: { name: "Batch 1" } });
    expect(data.enrollments[0]!.events.map((e) => e.stage)).toEqual(["ACTIVE"]);
    expect(data.applications.map((a) => a.stage)).toEqual(["ENROLLMENT_CONFIRMED"]);
    expect(await students.getStudent(id("cm"))).toBeNull();
  });

  it("deletes an account and its applications (CNIC, CV) for a privacy request (Super Admin, email confirmed)", async () => {
    const email = `ayesha.${tag}@example.com`;
    await db().newsletterSubscriber.create({ data: { email, unsubscribeToken: id("unsub") } });
    await expect(students.deleteStudent(id("s1"), email, cm)).rejects.toThrow(/Super Admins/);
    await expect(students.deleteStudent(id("s1"), "wrong@example.com", sa)).rejects.toThrow(/exactly/);
    await students.deleteStudent(id("s1"), ` ${email.toUpperCase()} `, sa);
    expect(await db().user.findUnique({ where: { id: id("s1") } })).toBeNull();
    expect(await db().enrollment.count({ where: { userId: id("s1") } })).toBe(0);
    expect(await db().newsletterSubscriber.count({ where: { email } })).toBe(0);
    expect(await db().enrollmentApplication.count({ where: { email } })).toBe(0);
    const log = await db().auditLog.findFirstOrThrow({ where: { entityId: id("s1"), action: "student.deleted" } });
    expect(log.metadata).toEqual({ enrollments: 1, certificates: 0, applications: 1 });
    await expect(students.deleteStudent(id("s1"), email, sa)).rejects.toThrow(/Student not found/);
  });
});
