/**
 * Student portal and student administration against a real database:
 * onboarding stages, documents, stage changes, transfers, withdrawals and
 * the clean-up of old free-sign-up accounts. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mailer", () => ({ sendMail: async () => {} }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("portal and student administration (integration)", async () => {
  const { db } = await import("@/lib/db");
  const portal = await import("@/modules/portal/service");
  const admin = await import("@/modules/enrollments/service");
  const students = await import("@/modules/students/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const sa = { id: id("sa"), role: "SUPER_ADMIN" as const };
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const coord = { id: id("coord"), role: "INSTRUCTOR" as const };
  let course = "";
  let batchA = "";
  let batchB = "";
  const enr: Record<string, string> = {};

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: sa.id, name: "Owner", email: `sa.${tag}@example.com`, role: "SUPER_ADMIN" },
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: coord.id, name: "Coord", email: `coord.${tag}@example.com`, role: "INSTRUCTOR" },
        ...["a1", "a2", "b1", "old", "oldpaid"].map((n) => ({ id: id(n), name: n, email: `${n}.${tag}@example.com`, role: "STUDENT" as const })),
      ],
    });
    course = (await db().course.create({ data: { slug: `t${tag}-c`, title: "eBay", summary: "Summary", language: "en", status: "PUBLISHED", createdById: sa.id } })).id;
    const mk = (code: string, capacity: number, coordinatorId: string | null) =>
      db().batch.create({ data: { courseId: course, name: `Batch ${code}`, code: `${code}${tag}`.toUpperCase(), status: "OPEN", startDate: new Date("2099-01-01T00:00:00Z"), scheduleText: "Mon", capacity, coordinatorId } });
    batchA = (await mk("A", 2, coord.id)).id;
    batchB = (await mk("B", 1, null)).id;
    for (const [n, batchId] of [["a1", batchA], ["a2", batchA], ["b1", batchB]] as const) {
      enr[n] = (await db().enrollment.create({ data: { userId: id(n), courseId: course, batchId, status: "APPROVED", stage: "ENROLLMENT_CONFIRMED" } })).id;
    }
    // An old free-sign-up account, and an old one that did pay through the previous flow.
    await db().enrollment.create({ data: { userId: id("old"), courseId: course, status: "REQUESTED" } });
    await db().payment.create({ data: { userId: id("oldpaid"), courseId: course, amount: 100, method: "JAZZCASH", reference: `OLD-${tag}`, status: "CONFIRMED" } });
  });

  afterAll(async () => {
    await db().payment.deleteMany({ where: { courseId: course } });
    await db().studentDocument.deleteMany({ where: { OR: [{ courseId: course }, { title: { startsWith: `t${tag}` } }] } });
    await db().onboardingItem.deleteMany({ where: { OR: [{ courseId: course }, { title: { startsWith: `t${tag}` } }] } });
    await db().notification.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { courseId: course } });
    await db().batch.deleteMany({ where: { courseId: course } });
    await db().course.delete({ where: { id: course } });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  const stageOf = async (n: string) => (await db().enrollment.findUniqueOrThrow({ where: { id: enr[n] } })).stage;

  it("starts onboarding on the first portal visit and activates once required steps are done", async () => {
    const step = await db().onboardingItem.create({ data: { courseId: course, title: `t${tag} Join the WhatsApp group`, required: true, studentCompletes: true } });
    const staffStep = await db().onboardingItem.create({ data: { batchId: batchA, courseId: course, title: `t${tag} Documents checked`, required: true, studentCompletes: false } });
    await db().onboardingItem.create({ data: { batchId: batchB, courseId: course, title: `t${tag} Only for B`, required: true } });
    await portal.advanceStages(id("a1"));
    expect(await stageOf("a1")).toBe("ONBOARDING");
    const items = (await portal.onboardingFor({ id: enr.a1!, courseId: course, batchId: batchA })).items.map((i) => i.title);
    expect(items).toEqual([`t${tag} Join the WhatsApp group`, `t${tag} Documents checked`]);

    await expect(portal.setOnboardingItem(id("a1"), enr.a1!, staffStep.id, true)).rejects.toThrow("staffOnly");
    await expect(portal.setOnboardingItem(id("a2"), enr.a1!, step.id, true)).rejects.toThrow("notFound");
    await portal.setOnboardingItem(id("a1"), enr.a1!, step.id, true);
    expect(await stageOf("a1")).toBe("ONBOARDING");
    // A coordinator of another batch can't confirm it; the batch's coordinator can, which completes onboarding.
    await expect(admin.confirmOnboardingItem(enr.b1!, staffStep.id, true, coord)).rejects.toThrow(/not found/i);
    await admin.confirmOnboardingItem(enr.a1!, staffStep.id, true, coord);
    expect(await stageOf("a1")).toBe("ACTIVE");
  });

  it("shares documents only with the students they're for", async () => {
    const doc = (title: string, extra: object) =>
      db().studentDocument.create({ data: { title: `t${tag} ${title}`, storageKey: `documents/t${tag}/${title}.pdf`, fileName: `${title}.pdf`, mimeType: "application/pdf", sizeBytes: 10, ...extra } });
    const everyone = await doc("rules", {});
    const forA = await doc("a-only", { courseId: course, batchId: batchA });
    const hidden = await doc("draft", { courseId: course, published: false });
    const titles = async (n: string) => (await portal.myDocuments(id(n))).map((d) => d.id);
    expect(await titles("a1")).toEqual(expect.arrayContaining([everyone.id, forA.id]));
    expect(await titles("a1")).not.toContain(hidden.id);
    expect(await titles("b1")).toContain(everyone.id);
    expect(await titles("b1")).not.toContain(forA.id);
    // No enrollment, no documents.
    expect(await titles("old")).toEqual([]);
  });

  it("changes stages with the right permissions and keeps seats honest", async () => {
    await expect(admin.setStage(enr.a1!, "COMPLETED", null, coord)).resolves.toBeUndefined();
    expect(await db().enrollment.findUniqueOrThrow({ where: { id: enr.a1 } })).toMatchObject({ stage: "COMPLETED", status: "APPROVED" });
    await admin.setStage(enr.a1!, "ACTIVE", null, cm);
    await expect(admin.setStage(enr.a1!, "WITHDRAWN", "Left", cm)).rejects.toThrow(/Only Super Admins/);
    await expect(admin.setStage(enr.a1!, "WITHDRAWN", "", sa)).rejects.toThrow(/reason/);
    await expect(admin.setStage(enr.a1!, "ENROLLMENT_CONFIRMED", null, sa)).rejects.toThrow(/isn't possible/);
    await admin.setStage(enr.a1!, "WITHDRAWN", "Moved abroad", sa);
    expect(await db().enrollment.findUniqueOrThrow({ where: { id: enr.a1 } })).toMatchObject({ stage: "WITHDRAWN", status: "REVOKED", decisionNote: "Moved abroad" });
    // A withdrawn student loses the portal's batch content.
    expect(await portal.myDocuments(id("a1"))).toEqual([]);
    expect((await portal.studentScope(id("a1"))).activeBatchIds).toEqual([]);
  });

  it("transfers only into a batch with a free seat; reinstating checks seats too", async () => {
    await expect(admin.transfer(enr.a2!, batchB, null, cm)).rejects.toThrow(/Only Super Admins/);
    // Batch B (1 seat) is taken by b1.
    await expect(admin.transfer(enr.a2!, batchB, null, sa)).rejects.toThrow(/is full/);
    await db().batch.update({ where: { id: batchB }, data: { capacity: 3 } });
    await admin.transfer(enr.a2!, batchB, "Evening timing suits better", sa);
    const moved = await db().enrollment.findUniqueOrThrow({ where: { id: enr.a2 }, include: { events: true } });
    expect(moved.batchId).toBe(batchB);
    expect(moved.events.some((e) => e.note?.startsWith("Transferred from Batch A to Batch B"))).toBe(true);

    // Fill batch A, then try to reinstate the withdrawn a1 into it.
    await db().batch.update({ where: { id: batchA }, data: { capacity: 1 } });
    await db().enrollment.update({ where: { id: enr.b1 }, data: { batchId: batchA, stage: "ACTIVE" } });
    await expect(admin.setStage(enr.a1!, "ACTIVE", null, sa)).rejects.toThrow(/is full/);
    await db().batch.update({ where: { id: batchA }, data: { capacity: 5 } });
    await admin.setStage(enr.a1!, "ACTIVE", null, sa);
    expect(await stageOf("a1")).toBe("ACTIVE");
  });

  it("finds and suspends only old free-sign-up accounts, after confirming the count", async () => {
    const { count, sample } = await students.legacyAccounts(500);
    const mine = sample.filter((u) => u.id.startsWith(`t${tag}`)).map((u) => u.id);
    expect(mine).toEqual([id("old")]);
    await expect(students.suspendLegacyAccounts(count + 1, sa)).rejects.toThrow(/changed/);
    await expect(students.suspendLegacyAccounts(count, cm)).rejects.toThrow(/Only Super Admins/);
    await students.suspendLegacyAccounts(count, sa);
    const statuses = await db().user.findMany({ where: { id: { in: [id("old"), id("oldpaid"), id("a1"), id("cm")] } }, select: { id: true, status: true } });
    expect(Object.fromEntries(statuses.map((u) => [u.id, u.status]))).toEqual({ [id("old")]: "SUSPENDED", [id("oldpaid")]: "ACTIVE", [id("a1")]: "ACTIVE", [id("cm")]: "ACTIVE" });
  });
});
