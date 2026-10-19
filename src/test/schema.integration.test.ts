/**
 * Database integration tests for the Phase 2 schema. Run with `npm run test:db`
 * (needs TEST_DATABASE_URL); skipped by the normal `npm test`.
 */
import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("schema (integration)", () => {
  let db: PrismaClient;
  const tag = randomUUID().slice(0, 8);
  const id = (name: string) => `t${tag}_${name}`;

  beforeAll(() => {
    db = new PrismaClient({ adapter: new PrismaMariaDb(url!) });
  });

  afterAll(async () => {
    // Clean up only what this run created (ids/emails carry the run tag).
    await db.auditLog.deleteMany({ where: { entityId: { startsWith: `t${tag}` } } });
    await db.inquiry.deleteMany({ where: { email: { contains: tag } } });
    await db.enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db.certificate.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db.course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db.mediaAsset.deleteMany({ where: { storageKey: { startsWith: `t${tag}` } } });
    await db.user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db.$disconnect();
  });

  const makeUser = (name: string, extra: object = {}) =>
    db.user.create({ data: { id: id(name), name, email: `${name}.${tag}@example.com`, ...extra } });

  const makeCourse = (slug: string) =>
    db.course.create({
      data: {
        slug: id(slug),
        language: "ur",
        title: "Course",
        summary: "Summary",
        modules: { create: { title: "Module 1", position: 0, lessons: { create: [{ title: "L1", position: 0 }, { title: "L2", position: 1 }] } } },
      },
      include: { modules: { include: { lessons: true } } },
    });

  it("applies safe defaults for new users and courses", async () => {
    const user = await makeUser("defaults");
    expect(user).toMatchObject({ role: "STUDENT", status: "ACTIVE", emailVerified: false, preferredLocale: "en" });
    const course = await makeCourse("defaults");
    expect(course).toMatchObject({ status: "DRAFT", enrollmentMode: "APPROVAL", accessType: "FREE", certificateEnabled: true });
  });

  it("stores Urdu text and emoji exactly", async () => {
    const text = "مجھے ایک آن لائن اسٹور چاہیے 👍 ٹ ڈ ڑ ں ے";
    const inquiry = await db.inquiry.create({
      data: { name: "عائشہ", email: `urdu.${tag}@example.com`, service: "general", message: text },
    });
    const back = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(back.message).toBe(text);
    expect(back.name).toBe("عائشہ");
    // Phase 2 lead fields are optional
    expect(back).toMatchObject({ locale: null, followUpAt: null, assignedToId: null, status: "NEW" });
  });

  it("allows only one enrollment per student per course, starting as REQUESTED", async () => {
    const user = await makeUser("enrol");
    const course = await makeCourse("enrol");
    const e = await db.enrollment.create({ data: { userId: user.id, courseId: course.id } });
    expect(e.status).toBe("REQUESTED");
    await expect(db.enrollment.create({ data: { userId: user.id, courseId: course.id } })).rejects.toThrow();
  });

  it("blocks deleting a course that has enrollments (archive instead)", async () => {
    const user = await makeUser("restrict");
    const course = await makeCourse("restrict");
    await db.enrollment.create({ data: { userId: user.id, courseId: course.id, status: "APPROVED" } });
    await expect(db.course.delete({ where: { id: course.id } })).rejects.toThrow();
    const archived = await db.course.update({ where: { id: course.id }, data: { status: "ARCHIVED" } });
    expect(archived.status).toBe("ARCHIVED");
  });

  it("removes a lesson's progress when the lesson is deleted", async () => {
    const user = await makeUser("progress");
    const course = await makeCourse("progress");
    const [l1, l2] = course.modules[0]!.lessons;
    await db.lessonProgress.createMany({
      data: [
        { userId: user.id, lessonId: l1!.id, completedAt: new Date() },
        { userId: user.id, lessonId: l2!.id },
      ],
    });
    await db.lesson.delete({ where: { id: l1!.id } });
    expect(await db.lessonProgress.count({ where: { userId: user.id } })).toBe(1);
  });

  it("protects media files that are in use by a course resource", async () => {
    const course = await makeCourse("media");
    const media = await db.mediaAsset.create({
      data: { storageKey: id("media/worksheet.pdf"), originalName: "worksheet.pdf", mimeType: "application/pdf", sizeBytes: 1024, visibility: "PRIVATE" },
    });
    await db.courseResource.create({ data: { courseId: course.id, title: "Worksheet", kind: "FILE", mediaAssetId: media.id } });
    await expect(db.mediaAsset.delete({ where: { id: media.id } })).rejects.toThrow();
  });

  it("issues at most one certificate per student per course, with unique codes", async () => {
    const user = await makeUser("cert");
    const course = await makeCourse("cert");
    const data = { userId: user.id, courseId: course.id, recipientName: "Student", courseTitle: "Course" };
    await db.certificate.create({ data: { ...data, code: id("C1") } });
    await expect(db.certificate.create({ data: { ...data, code: id("C2") } })).rejects.toThrow();
  });

  it("deleting a user removes their personal records but keeps leads and audit history", async () => {
    const admin = await makeUser("admin", { role: "SUPER_ADMIN" });
    const student = await makeUser("student");
    const course = await makeCourse("userdelete");
    await db.session.create({ data: { id: id("sess"), token: id("token"), userId: student.id, expiresAt: new Date(Date.now() + 3600_000) } });
    await db.enrollment.create({ data: { userId: student.id, courseId: course.id, decidedById: admin.id, status: "APPROVED" } });
    const lead = await db.inquiry.create({
      data: { name: "Lead", email: `lead.${tag}@example.com`, service: "general", message: "Hello there", assignedToId: admin.id },
    });
    const log = await db.auditLog.create({ data: { actorId: admin.id, action: "enrollment.approve", entityType: "Enrollment", entityId: id("audit") } });

    await db.user.delete({ where: { id: student.id } });
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    expect(await db.enrollment.count({ where: { userId: student.id } })).toBe(0);

    await db.user.delete({ where: { id: admin.id } });
    expect((await db.inquiry.findUniqueOrThrow({ where: { id: lead.id } })).assignedToId).toBeNull();
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: log.id } })).actorId).toBeNull();
  });
});
