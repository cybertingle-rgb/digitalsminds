/**
 * The catalogue (categories and services) against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

const KEYS = ["catalog.servicesSeeded"];

run("catalogue (integration)", async () => {
  const { db } = await import("@/lib/db");
  const catalog = await import("@/modules/catalog/service");
  const tag = randomUUID().slice(0, 8);
  const cm = { id: `t${tag}_cm`, role: "CONTENT_MANAGER" as const };
  let saved: { key: string; value: unknown }[] = [];
  let savedServices: { slug: string }[] = [];


  beforeAll(async () => {
    saved = (await db().siteSetting.findMany({ where: { key: { in: KEYS } } })).map((r) => ({ key: r.key, value: r.value }));
    savedServices = await db().service.findMany({ select: { slug: true } });
    await db().siteSetting.deleteMany({ where: { key: { in: KEYS } } });
    await db().user.createMany({
      data: [
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
      ],
    });
  });

  afterAll(async () => {
    await db().service.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    if (savedServices.length === 0) await db().service.deleteMany({});
    await db().programCategory.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().siteSetting.deleteMany({ where: { key: { in: KEYS } } });
    for (const s of saved) await db().siteSetting.create({ data: { key: s.key, value: s.value as object } });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("seeds the starting services once and validates inquiry topics", async () => {
    const services = await catalog.siteServices();
    expect(services.length).toBeGreaterThanOrEqual(9);
    expect(services.map((s) => s.slug)).toEqual(expect.arrayContaining(["international-brand-launch", "llc-marketplace-readiness", "account-reinstatement", "ai-automation", "web-ecommerce"]));
    const reinstatement = services.find((s) => s.slug === "account-reinstatement")!;
    expect(reinstatement.notice).toMatch(/cannot be guaranteed/);
    expect(reinstatement.notice).toMatch(/never ask for your marketplace password/);
    expect(await catalog.isInquiryTopic("account-reinstatement")).toBe(true);
    expect(await catalog.isInquiryTopic("general")).toBe(true);
    expect(await catalog.isInquiryTopic("not-a-service")).toBe(false);

    // Deleting a seeded service doesn't bring it back.
    const row = await db().service.findUniqueOrThrow({ where: { slug: "ai-automation" } });
    await expect(catalog.deleteService(row.id, { id: `t${tag}_x`, role: "INSTRUCTOR" })).rejects.toThrow(/permission/);
    await catalog.deleteService(row.id, cm);
    await catalog.ensureServices();
    expect(await db().service.findUnique({ where: { slug: "ai-automation" } })).toBeNull();
    expect(await catalog.isInquiryTopic("ai-automation")).toBe(false);
  });

  it("manages categories and services with permission checks and unique addresses", async () => {
    const input = catalog.categoryInput.parse({ slug: `t${tag}-cat`, title: "Test category", notice: "No guarantees.", sortOrder: "5", active: true });
    await expect(catalog.saveCategory(null, input, { id: `t${tag}_x`, role: "INSTRUCTOR" })).rejects.toThrow(/permission/);
    const cat = await catalog.saveCategory(null, input, cm);
    await expect(catalog.saveCategory(null, input, cm)).rejects.toThrow(/already uses/);
    const svc = await catalog.saveService(
      null,
      catalog.serviceInput.parse({ slug: `t${tag}-svc`, title: "Test service", summary: "A short summary", offerings: "- One\n\n• Two\nThree", idealFor: "", categoryId: cat.id, sortOrder: "1", status: "DRAFT" }),
      cm,
    );
    expect(catalog.stringList(svc.offerings)).toEqual(["One", "Two", "Three"]);
    expect(await catalog.siteService(`t${tag}-svc`)).toBeNull(); // drafts are not public
    await catalog.saveService(svc.id, catalog.serviceInput.parse({ slug: `t${tag}-svc`, title: "Test service", summary: "A short summary", offerings: "One", categoryId: cat.id, sortOrder: "1", status: "PUBLISHED" }), cm);
    expect(await catalog.siteService(`t${tag}-svc`)).toMatchObject({ title: "Test service", category: { title: "Test category" } });
    await expect(catalog.saveService(null, catalog.serviceInput.parse({ slug: `t${tag}-svc2`, title: "Other", summary: "A short summary", categoryId: "missing", sortOrder: "1", status: "DRAFT" }), cm)).rejects.toThrow(/existing category/);
    // Deleting the category leaves the service uncategorised.
    await catalog.deleteCategory(cat.id, cm);
    expect((await db().service.findUniqueOrThrow({ where: { id: svc.id } })).categoryId).toBeNull();
  });
});
