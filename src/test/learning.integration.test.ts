/**
 * Enrollment requests, decisions, lesson access and progress against a real
 * database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Emails are best effort; keep tests offline.
vi.mock("@/lib/mailer", () => ({ sendMail: async () => {} }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("learning (integration)", async () => {
  const { db } = await import("@/lib/db");
  const enroll = await import("@/modules/learning/enrollment");
  const progress = await import("@/modules/learning/progress");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  type Role = "SUPER_ADMIN" | "CONTENT_MANAGER" | "INSTRUCTOR" | "STUDENT";
  const users: Record<string, { id: string; role: Role }> = {};
  const u = (n: string) => users[n]!;
  let courseId = "";
  let slug = "";
  let lessonIds: string[] = [];

  beforeAll(async () => {
    for (const [n, role] of [["cm", "CONTENT_MANAGER"], ["teach", "INSTRUCTOR"], ["amna", "STUDENT"], ["bilal", "STUDENT"]] as const) {
      await db().user.create({ data: { id: id(n), name: n, email: `${n}.${tag}@example.com`, role } });
      users[n] = { id: id(n), role };
    }
    slug = `t${tag}-course`;
    const course = await db().course.create({
      data: {
        slug,
        title: "Course",
        summary: "A course summary",
        language: "en",
        status: "PUBLISHED",
        createdById: id("cm"),
        instructors: { create: { userId: id("teach") } },
        modules: {
          create: [
            { title: "M1", position: 0, lessons: { create: [{ title: "L1", position: 0, isPreview: true }, { title: "L2", position: 1 }] } },
            { title: "M2", position: 1, lessons: { create: [{ title: "L3", position: 0 }] } },
          ],
        },
      },
      include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" } } } } },
    });
    courseId = course.id;
    lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().lessonProgress.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("handles a request, saves the Google email and blocks duplicates", async () => {
    await enroll.requestEnrollment(u("amna"), courseId, { googleEmail: "amna.g@gmail.com", note: "Keen to learn" });
    expect((await db().user.findUniqueOrThrow({ where: { id: id("amna") } })).googleEmail).toBe("amna.g@gmail.com");
    await expect(enroll.requestEnrollment(u("amna"), courseId, { googleEmail: "amna.g@gmail.com", note: null })).rejects.toThrow("alreadyRequested");
    const e = await enroll.enrollmentFor(id("amna"), courseId);
    expect(e?.status).toBe("REQUESTED");
    expect(e?.requestNote).toBe("Keen to learn");
  });

  it("only lets permitted staff decide, and only valid transitions", async () => {
    const e = (await enroll.enrollmentFor(id("amna"), courseId))!;
    await expect(enroll.decideEnrollment(e.id, "APPROVED", null, u("teach"))).rejects.toThrow(/permission/);
    await expect(enroll.decideEnrollment(e.id, "REVOKED", null, u("cm"))).rejects.toThrow(/already handled/);
    await enroll.decideEnrollment(e.id, "APPROVED", null, u("cm"));
    await expect(enroll.decideEnrollment(e.id, "APPROVED", null, u("cm"))).rejects.toThrow(/already handled/);
    const after = await db().enrollment.findUniqueOrThrow({ where: { id: e.id } });
    expect(after.status).toBe("APPROVED");
    expect(after.decidedById).toBe(id("cm"));
  });

  it("controls lesson access by mode", async () => {
    const student = await progress.learnerContext(u("amna"), slug);
    expect(student?.mode).toBe("student");
    const other = await progress.learnerContext(u("bilal"), slug);
    expect(other?.mode).toBe("preview");
    expect(progress.canOpenLesson("preview", { isPreview: true })).toBe(true);
    expect(progress.canOpenLesson("preview", { isPreview: false })).toBe(false);
    expect((await progress.learnerContext(u("teach"), slug))?.mode).toBe("staff");
    expect((await progress.learnerContext(null, slug))?.mode).toBe("preview");
  });

  it("tracks progress, continue position and completion", async () => {
    expect(await progress.continueLessonId(id("amna"), (await progress.learnerContext(u("amna"), slug))!.course)).toBe(lessonIds[0]);
    await progress.recordView(id("amna"), lessonIds[1]!);
    expect(await progress.continueLessonId(id("amna"), (await progress.learnerContext(u("amna"), slug))!.course)).toBe(lessonIds[1]);
    // Non-enrolled users can't record completion.
    expect(await progress.setLessonComplete(u("bilal"), slug, lessonIds[0]!, true)).toBeNull();
    // Lessons from other courses are ignored.
    expect(await progress.setLessonComplete(u("amna"), slug, "not-a-lesson", true)).toBeNull();
    for (const l of lessonIds.slice(0, 2)) await progress.setLessonComplete(u("amna"), slug, l, true);
    let r = await progress.setLessonComplete(u("amna"), slug, lessonIds[1]!, false);
    expect(r).toEqual({ done: 1, total: 3, all: false });
    for (const l of lessonIds.slice(1)) r = await progress.setLessonComplete(u("amna"), slug, l, true);
    expect(r).toEqual({ done: 3, total: 3, all: true });
    expect((await enroll.enrollmentFor(id("amna"), courseId))?.completedAt).toBeInstanceOf(Date);
    const [dash] = await progress.myLearning(id("amna"));
    expect(dash).toMatchObject({ done: 3, total: 3, percent: 100, canLearn: true });
  });

  it("revoking or unpublishing removes access immediately; archived courses stay open to students", async () => {
    await db().course.update({ where: { id: courseId }, data: { status: "ARCHIVED" } });
    expect((await progress.learnerContext(u("amna"), slug))?.mode).toBe("student");
    expect((await progress.learnerContext(u("bilal"), slug))?.mode).toBeNull();
    await expect(enroll.requestEnrollment(u("bilal"), courseId, { googleEmail: "b@gmail.com", note: null })).rejects.toThrow("notAvailable");
    await db().course.update({ where: { id: courseId }, data: { status: "DRAFT" } });
    expect((await progress.learnerContext(u("amna"), slug))?.mode).toBeNull();
    await db().course.update({ where: { id: courseId }, data: { status: "PUBLISHED" } });

    const e = (await enroll.enrollmentFor(id("amna"), courseId))!;
    await enroll.decideEnrollment(e.id, "REVOKED", "Course ended", u("cm"));
    expect((await progress.learnerContext(u("amna"), slug))?.mode).toBe("preview");
    // A revoked student can ask again, which resets the decision.
    await enroll.requestEnrollment(u("amna"), courseId, { googleEmail: "amna.g@gmail.com", note: null });
    const again = (await enroll.enrollmentFor(id("amna"), courseId))!;
    expect(again).toMatchObject({ status: "REQUESTED", decisionNote: null, decidedById: null });
  });

  it("lets enrolled students download private resource files only", async () => {
    const file = await db().mediaAsset.create({
      data: { storageKey: `private/${tag}/w.pdf`, originalName: "w.pdf", mimeType: "application/pdf", sizeBytes: 10, visibility: "PRIVATE", uploadedById: id("teach") },
    });
    await db().courseResource.create({ data: { courseId, lessonId: lessonIds[0]!, title: "Worksheet", kind: "FILE", mediaAssetId: file.id } });
    const e = (await enroll.enrollmentFor(id("amna"), courseId))!;
    expect(await progress.studentCanDownload(id("amna"), file.id)).toBe(false);
    await enroll.decideEnrollment(e.id, "APPROVED", null, u("cm"));
    expect(await progress.studentCanDownload(id("amna"), file.id)).toBe(true);
    expect(await progress.studentCanDownload(id("bilal"), file.id)).toBe(false);
    await db().courseResource.deleteMany({ where: { mediaAssetId: file.id } });
    await db().mediaAsset.delete({ where: { id: file.id } });
  });

  it("filters the admin queue by status, course and search", async () => {
    await enroll.requestEnrollment(u("bilal"), courseId, { googleEmail: "bilal.g@gmail.com", note: null });
    const waiting = await enroll.listEnrollments({ status: "REQUESTED", courseId }, 1, 25);
    expect(waiting.items.map((i) => i.user.name)).toEqual(["bilal"]);
    expect(waiting.byStatus).toMatchObject({ REQUESTED: 1, APPROVED: 1 });
    expect((await enroll.listEnrollments({ status: "APPROVED", courseId, q: "amna.g@" }, 1, 25)).items).toHaveLength(1);
    expect(enroll.parseQueueFilter({ status: "HACKED", course: ["x"] })).toEqual({ status: "REQUESTED", courseId: undefined, q: undefined });
  });
});
