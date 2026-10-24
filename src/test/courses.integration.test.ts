/**
 * Program (course) and batch rules against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("programs and batches (integration)", async () => {
  const { db } = await import("@/lib/db");
  const svc = await import("@/modules/courses/service");
  const batches = await import("@/modules/batches/service");
  const { setCoursePrice } = await import("@/modules/payments/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  type Role = "SUPER_ADMIN" | "CONTENT_MANAGER" | "INSTRUCTOR" | "STUDENT";
  const actors: Record<string, { id: string; role: Role }> = {};
  const as = (n: string) => actors[n]!;
  const base = { title: "Placeholder program", language: "en" as const, summary: "A summary long enough." };

  beforeAll(async () => {
    for (const [n, role] of [["sa", "SUPER_ADMIN"], ["cm", "CONTENT_MANAGER"], ["coord", "INSTRUCTOR"], ["student", "STUDENT"]] as const) {
      const u = await db().user.create({ data: { id: id(n), name: n, email: `${n}.${tag}@example.com`, role } });
      actors[n] = { id: u.id, role };
    }
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().batch.deleteMany({ where: { course: { createdById: { startsWith: `t${tag}` } } } });
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
    durationText: "8 weeks",
    format: "ONLINE_LIVE" as const,
    thumbnailId: null,
    serviceSlug: null, categoryId: null,
    certificateEnabled: true,
    seoTitle: null,
    seoDescription: null,
    ...extra,
  });

  const batch = (courseId: string, extra: object = {}) =>
    batches.batchInput.parse({ courseId, name: "Batch 1", code: `B${tag}`.slice(0, 12), status: "OPEN", startDate: "2099-01-10", scheduleText: "Mon, Wed · 8 pm", capacity: "2", ...extra });

  it("lets only program managers create programs, with unique slugs", async () => {
    const one = await svc.createCourse({ ...base, title: `Brand Basics ${tag}` }, as("cm"));
    const twin = await svc.createCourse({ ...base, title: `Brand Basics ${tag}` }, as("cm"));
    expect(one.slug).toBe(`brand-basics-${tag}`);
    expect(twin.slug).toBe(`brand-basics-${tag}-2`);
    await expect(svc.createCourse(base, as("coord"))).rejects.toThrow(/can't create/);
    await expect(svc.createCourse(base, as("student"))).rejects.toThrow(/can't create/);
    expect(await svc.getCourseForEdit(one.id, as("coord"))).toBeNull();
  });

  it("requires a fee before publishing, and locks the slug once published", async () => {
    const c = await svc.createCourse({ ...base, title: `Publish ${tag}` }, as("cm"));
    await expect(svc.setCourseStatus(c.id, "PUBLISHED", as("cm"))).rejects.toThrow(/Enrollment fee set/);
    await expect(setCoursePrice(c.id, { paid: true, pricePkr: 15000 }, as("cm"))).rejects.toThrow(/Super Admin/);
    await setCoursePrice(c.id, { paid: true, pricePkr: 15000 }, as("sa"));
    await svc.setCourseStatus(c.id, "PUBLISHED", as("cm"));
    const published = await db().course.findUniqueOrThrow({ where: { id: c.id } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.priceAmount).toBe(1_500_000);

    await expect(svc.updateCourseDetails(c.id, details({ ...published, slug: "new-address" }), as("cm"))).rejects.toThrow(/can't change after/);
    await svc.updateCourseDetails(c.id, details(published, { objectives: ["Learn"], durationText: "6 weeks", format: "HYBRID" }), as("cm"));
    const saved = await db().course.findUniqueOrThrow({ where: { id: c.id } });
    expect([saved.objectives, saved.durationText, saved.format]).toEqual([["Learn"], "6 weeks", "HYBRID"]);
  });

  it("only accepts public images as thumbnails", async () => {
    const c = await svc.createCourse({ ...base, title: `Media ${tag}` }, as("cm"));
    const asset = (n: string, visibility: "PUBLIC" | "PRIVATE") =>
      db().mediaAsset.create({ data: { storageKey: `${visibility.toLowerCase()}/${tag}/${n}`, originalName: n, mimeType: "image/webp", sizeBytes: 10, visibility, uploadedById: id("cm") } });
    const pub = await asset("pub.webp", "PUBLIC");
    const priv = await asset("priv.webp", "PRIVATE");
    const course = await db().course.findUniqueOrThrow({ where: { id: c.id } });
    await expect(svc.updateCourseDetails(c.id, details(course, { thumbnailId: priv.id }), as("cm"))).rejects.toThrow(/public image/);
    await svc.updateCourseDetails(c.id, details(course, { thumbnailId: pub.id }), as("cm"));
  });

  it("manages batches: permissions, unique codes, seats and coordinator scope", async () => {
    const c = await svc.createCourse({ ...base, title: `Batches ${tag}` }, as("cm"));
    await expect(batches.createBatch(batch(c.id), as("coord"))).rejects.toThrow(/permission/);
    const b = await batches.createBatch(batch(c.id, { coordinatorId: id("coord") }), as("cm"));
    await expect(batches.createBatch(batch(c.id), as("cm"))).rejects.toThrow(/already uses this code/);
    await expect(batches.createBatch(batch(c.id, { code: `X${tag}`.slice(0, 12), coordinatorId: id("student") }), as("cm"))).rejects.toThrow(/active team member/);
    expect(() => batch(c.id, { endDate: "2099-01-01" })).toThrow(/Ends before it starts/);

    // A coordinator sees only their batches; seats count verified students.
    expect((await batches.listBatches(as("coord"))).map((x) => x.id)).toEqual([b.id]);
    expect(await batches.getBatch(b.id, as("coord"))).not.toBeNull();
    await db().enrollment.create({ data: { userId: id("student"), courseId: c.id, batchId: b.id, status: "APPROVED", stage: "ACTIVE" } });
    const seen = await batches.getBatch(b.id, as("cm"));
    expect([seen!.taken, seen!.open]).toEqual([1, "open"]);
    expect(() => batch(c.id, { capacity: "0" })).toThrow(/At least 1 seat/);
    await batches.updateBatch(b.id, batch(c.id, { capacity: "1", status: "OPEN" }), as("cm"));
    await expect(svc.setCourseStatus(c.id, "PUBLISHED", as("cm"))).rejects.toThrow(/fee/);
    await setCoursePrice(c.id, { paid: true, pricePkr: 5000 }, as("sa"));
    await svc.setCourseStatus(c.id, "PUBLISHED", as("cm"));
    const pub = await batches.publicBatches(c.id);
    expect(pub.map((x) => [x.seatsLeft, x.open])).toEqual([[0, "full"]]);
  });

  it("only deletes unused drafts", async () => {
    const c = await svc.createCourse({ ...base, title: `Delete ${tag}` }, as("cm"));
    await setCoursePrice(c.id, { paid: true, pricePkr: 1000 }, as("sa"));
    await svc.setCourseStatus(c.id, "PUBLISHED", as("cm"));
    await expect(svc.deleteCourse(c.id, as("cm"))).rejects.toThrow(/Only draft/);
    await svc.setCourseStatus(c.id, "DRAFT", as("cm"));
    const b = await batches.createBatch(batch(c.id, { code: `D${tag}`.slice(0, 12) }), as("cm"));
    await expect(svc.deleteCourse(c.id, as("cm"))).rejects.toThrow(/archived/);
    await db().batch.delete({ where: { id: b.id } });
    await svc.deleteCourse(c.id, as("cm"));
    expect(await db().course.findUnique({ where: { id: c.id } })).toBeNull();
  });
});
