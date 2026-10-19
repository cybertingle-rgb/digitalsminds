/**
 * Course authoring rules against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const DRIVE = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing";

run("course authoring (integration)", async () => {
  const { db } = await import("@/lib/db");
  const svc = await import("@/modules/courses/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  type Role = "SUPER_ADMIN" | "CONTENT_MANAGER" | "INSTRUCTOR" | "STUDENT";
  const actors: Record<string, { id: string; role: Role }> = {};
  const as = (n: string) => actors[n]!;
  const base = { title: "Placeholder course", language: "en" as const, summary: "A summary long enough." };

  beforeAll(async () => {
    for (const [n, role] of [["cm", "CONTENT_MANAGER"], ["teach", "INSTRUCTOR"], ["other", "INSTRUCTOR"], ["student", "STUDENT"]] as const) {
      const u = await db().user.create({ data: { id: id(n), name: n, email: `${n}.${tag}@example.com`, role } });
      actors[n] = { id: u.id, role };
    }
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().lessonProgress.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().course.deleteMany({ where: { createdById: { startsWith: `t${tag}` } } });
    await db().mediaAsset.deleteMany({ where: { uploadedById: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  const details = (c: { title: string; slug: string; summary: string }, extra: object = {}) => ({
    title: c.title,
    titleUr: null,
    slug: c.slug,
    language: "en" as const,
    summary: c.summary,
    summaryUr: null,
    description: null,
    objectives: [],
    prerequisites: null,
    level: "ALL_LEVELS" as const,
    durationMinutes: null,
    thumbnailId: null,
    serviceSlug: null,
    certificateEnabled: true,
    seoTitle: null,
    seoDescription: null,
    ...extra,
  });

  it("gives instructors their own courses only, and unique slugs", async () => {
    const mine = await svc.createCourse({ ...base, title: `Brand Basics ${tag}` }, as("teach"));
    const twin = await svc.createCourse({ ...base, title: `Brand Basics ${tag}` }, as("cm"));
    expect(mine.slug).toBe(`brand-basics-${tag}`);
    expect(twin.slug).toBe(`brand-basics-${tag}-2`);
    // The instructor is assigned to the course they created; the CM's course has no instructor.
    expect(await svc.getCourseForEdit(mine.id, as("teach"))).not.toBeNull();
    expect(await svc.getCourseForEdit(twin.id, as("teach"))).toBeNull();
    expect(await svc.getCourseForEdit(mine.id, as("other"))).toBeNull();
    await expect(svc.addModule(twin.id, { title: "Sneaky" }, as("other"))).rejects.toThrow(/not found/);
    const listed = (await svc.listCourses(as("teach"))).map((c) => c.id);
    expect(listed).toContain(mine.id);
    expect(listed).not.toContain(twin.id);
    await expect(svc.createCourse(base, as("student"))).rejects.toThrow(/can't create/);
    await expect(svc.setInstructors(mine.id, [as("other").id], as("teach"))).rejects.toThrow(/Content Managers/);
    await expect(svc.setInstructors(mine.id, [as("student").id], as("cm"))).rejects.toThrow(/active instructors/);
    await svc.setInstructors(twin.id, [as("teach").id, as("other").id], as("cm"));
    expect(await svc.getCourseForEdit(twin.id, as("other"))).not.toBeNull();
  });

  it("builds a curriculum, reorders it and normalises Drive links", async () => {
    const c = await svc.createCourse({ ...base, title: `Curriculum ${tag}` }, as("cm"));
    const m1 = await svc.addModule(c.id, { title: "One" }, as("cm"));
    const m2 = await svc.addModule(c.id, { title: "Two" }, as("cm"));
    const a = await svc.addLesson(m1.id, "A", as("cm"));
    const b = await svc.addLesson(m1.id, "B", as("cm"));
    await svc.moveLesson(b.id, "up", as("cm"));
    await svc.moveModule(m2.id, "up", as("cm"));
    // Moving past the ends is a no-op.
    await svc.moveModule(m2.id, "up", as("cm"));
    let course = (await svc.getCourseForEdit(c.id, as("cm")))!;
    expect(course.modules.map((m) => m.title)).toEqual(["Two", "One"]);
    expect(course.modules[1]!.lessons.map((l) => l.title)).toEqual(["B", "A"]);

    await svc.moveLessonToModule(a.id, m2.id, as("cm"));
    await svc.updateLesson(a.id, { title: "A!", content: "## Hi", videoUrl: DRIVE, durationMinutes: 12, isPreview: true }, as("cm"));
    await expect(svc.updateLesson(b.id, { title: "B", content: null, videoUrl: "https://youtube.com/watch?v=x", durationMinutes: null, isPreview: false }, as("cm"))).rejects.toThrow(/Google Drive/);
    course = (await svc.getCourseForEdit(c.id, as("cm")))!;
    const moved = course.modules[0]!.lessons[0]!;
    expect(moved.title).toBe("A!");
    expect(moved.videoProvider).toBe("GOOGLE_DRIVE");
    expect(moved.videoUrl).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view");
  });

  it("enforces the publishing checklist, permissions and the slug lock", async () => {
    const c = await svc.createCourse({ ...base, title: `Publish ${tag}` }, as("teach"));
    await expect(svc.setCourseStatus(c.id, "PUBLISHED", as("teach"))).rejects.toThrow(/Ask a Content Manager/);
    await expect(svc.setCourseStatus(c.id, "PUBLISHED", as("cm"))).rejects.toThrow(/At least one lesson/);
    const m = await svc.addModule(c.id, { title: "Only" }, as("teach"));
    await svc.addModule(c.id, { title: "Empty" }, as("teach"));
    await svc.addLesson(m.id, "Lesson", as("teach"));
    await expect(svc.setCourseStatus(c.id, "PUBLISHED", as("cm"))).rejects.toThrow(/Every module/);
    const empty = (await svc.getCourseForEdit(c.id, as("cm")))!.modules.find((x) => x.title === "Empty")!;
    await svc.deleteModule(empty.id, as("teach"));
    await svc.setCourseStatus(c.id, "PUBLISHED", as("cm"));
    const published = await db().course.findUniqueOrThrow({ where: { id: c.id } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeInstanceOf(Date);

    await expect(svc.updateCourseDetails(c.id, details({ ...published, slug: "new-address" }), as("teach"))).rejects.toThrow(/can't change after/);
    await svc.updateCourseDetails(c.id, details(published, { title: `Publish ${tag} v2`, objectives: ["Learn"] }), as("teach"));
    expect((await db().course.findUniqueOrThrow({ where: { id: c.id } })).objectives).toEqual(["Learn"]);

    // Unpublishing keeps the first publish date, so the slug stays locked.
    await svc.setCourseStatus(c.id, "DRAFT", as("cm"));
    expect((await db().course.findUniqueOrThrow({ where: { id: c.id } })).publishedAt).toEqual(published.publishedAt);
    await expect(svc.updateCourseDetails(c.id, details({ ...published, slug: "new-address" }), as("cm"))).rejects.toThrow(/can't change after/);
  });

  it("only accepts the user's own public images as thumbnails and own files as resources", async () => {
    const c = await svc.createCourse({ ...base, title: `Media ${tag}` }, as("teach"));
    const asset = (n: string, owner: string, visibility: "PUBLIC" | "PRIVATE", mimeType: string) =>
      db().mediaAsset.create({ data: { storageKey: `${visibility.toLowerCase()}/${tag}/${n}`, originalName: n, mimeType, sizeBytes: 10, visibility, uploadedById: id(owner) } });
    const own = await asset("own.webp", "teach", "PUBLIC", "image/webp");
    const privateImg = await asset("private.webp", "teach", "PRIVATE", "image/webp");
    const theirs = await asset("theirs.webp", "cm", "PUBLIC", "image/webp");
    const pdf = await asset("notes.pdf", "teach", "PRIVATE", "application/pdf");
    const course = await db().course.findUniqueOrThrow({ where: { id: c.id } });

    await expect(svc.updateCourseDetails(c.id, details(course, { thumbnailId: privateImg.id }), as("teach"))).rejects.toThrow(/public image/);
    await expect(svc.updateCourseDetails(c.id, details(course, { thumbnailId: theirs.id }), as("teach"))).rejects.toThrow(/public image/);
    await svc.updateCourseDetails(c.id, details(course, { thumbnailId: own.id }), as("teach"));

    await expect(svc.addResource(c.id, null, { kind: "FILE", title: "Theirs", mediaAssetId: theirs.id }, as("teach"))).rejects.toThrow(/Media library/);
    await svc.addResource(c.id, null, { kind: "FILE", title: "Notes", mediaAssetId: pdf.id }, as("teach"));
    await svc.addResource(c.id, null, { kind: "LINK", title: "Guide", url: "https://example.com/guide" }, as("teach"));
    const res = (await svc.getCourseForEdit(c.id, as("teach")))!.resources;
    expect(res.map((r) => [r.title, r.position])).toEqual([["Notes", 0], ["Guide", 1]]);
    await svc.deleteResource(res[1]!.id, as("teach"));
    await expect(svc.deleteResource(res[0]!.id, as("other"))).rejects.toThrow(/not found/);
  });

  it("protects student progress and only deletes unused drafts", async () => {
    const c = await svc.createCourse({ ...base, title: `Delete ${tag}` }, as("cm"));
    const m = await svc.addModule(c.id, { title: "M" }, as("cm"));
    const l = await svc.addLesson(m.id, "L", as("cm"));
    await db().lessonProgress.create({ data: { userId: as("student").id, lessonId: l.id } });
    await expect(svc.deleteLesson(l.id, as("cm"))).rejects.toThrow(/progress/);
    await expect(svc.deleteModule(m.id, as("cm"))).rejects.toThrow(/progress/);

    await svc.setCourseStatus(c.id, "PUBLISHED", as("cm"));
    await expect(svc.deleteCourse(c.id, as("cm"))).rejects.toThrow(/Only draft/);
    await svc.setCourseStatus(c.id, "DRAFT", as("cm"));
    await db().enrollment.create({ data: { userId: as("student").id, courseId: c.id } });
    await expect(svc.deleteCourse(c.id, as("cm"))).rejects.toThrow(/archived/);
    await db().enrollment.deleteMany({ where: { courseId: c.id } });
    await db().lessonProgress.deleteMany({ where: { lessonId: l.id } });
    await svc.deleteCourse(c.id, as("cm"));
    expect(await db().course.findUnique({ where: { id: c.id } })).toBeNull();
    const actions = (await db().auditLog.findMany({ where: { entityId: c.id }, select: { action: true } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["course.created", "course.published", "course.unpublished", "course.deleted", "course.curriculum_changed"]));
  });
});
