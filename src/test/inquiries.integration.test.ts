/**
 * Lead management against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("lead management (integration)", async () => {
  const { db } = await import("@/lib/db");
  const leads = await import("@/modules/inquiries/admin");
  const { pkDay } = await import("@/lib/pk-time");
  const tag = randomUUID().slice(0, 8);
  const email = (n: string) => `${n}.${tag}@lead.test`;
  type U = Awaited<ReturnType<ReturnType<typeof db>["user"]["create"]>>;
  let admin: U, cm: U, student: U;
  // Created in beforeAll (not while collecting), so `npm test` without a database just skips this suite.
  beforeAll(async () => {
    admin = await db().user.create({ data: { id: `t${tag}_admin`, name: "Admin", email: `admin.${tag}@example.com`, role: "SUPER_ADMIN" } });
    cm = await db().user.create({ data: { id: `t${tag}_cm`, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" } });
    student = await db().user.create({ data: { id: `t${tag}_st`, name: "Student", email: `st.${tag}@example.com`, role: "STUDENT" } });
  });
  const day = 24 * 60 * 60 * 1000;
  const today = pkDay();
  const mk = (n: string, data: object = {}) =>
    db().inquiry.create({ data: { name: n, email: email(n), service: "web-ecommerce", message: `Message from ${n} ${tag}`, ...data } });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().inquiry.deleteMany({ where: { email: { endsWith: `${tag}@lead.test` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  const ids = async (f: Parameters<typeof leads.buildWhere>[0], actor = admin) =>
    (await db().inquiry.findMany({ where: { AND: [leads.buildWhere(f, actor), { email: { endsWith: `${tag}@lead.test` } }] }, select: { name: true } }))
      .map((r) => r.name)
      .sort();

  it("filters by search, status (spam hidden by default), assignee and follow-up day in Pakistan time", async () => {
    await mk("alpha", { company: "Brand Co", assignedToId: cm.id, followUpAt: new Date(`${today}T00:00:00+05:00`) });
    await mk("bravo", { status: "CONTACTED", followUpAt: new Date(Date.parse(`${today}T00:00:00+05:00`) - 3 * day) });
    await mk("charlie", { status: "QUALIFIED", followUpAt: new Date(Date.parse(`${today}T00:00:00+05:00`) + 2 * day), assignedToId: admin.id });
    await mk("delta", { status: "SPAM" });
    await mk("echo", { status: "CLOSED", followUpAt: new Date(Date.parse(`${today}T00:00:00+05:00`) - 3 * day) });

    expect(await ids({})).toEqual(["alpha", "bravo", "charlie", "echo"]);
    expect(await ids({ status: "SPAM" })).toEqual(["delta"]);
    expect(await ids({ q: "brand co" })).toEqual(["alpha"]);
    expect(await ids({ assignee: "me" })).toEqual(["charlie"]);
    expect(await ids({ assignee: "none" })).toEqual(["bravo", "echo"]);
    expect(await ids({ followUp: "today" })).toEqual(["alpha"]);
    // Closed leads never count as overdue.
    expect(await ids({ followUp: "overdue" })).toEqual(["bravo"]);
    expect(await ids({ followUp: "upcoming" })).toEqual(["charlie"]);
  });

  it("ignores unknown filter values instead of failing", () => {
    expect(leads.parseFilters({ status: "HACKED", followUp: "yesterday", service: "drop table" })).toEqual({
      q: undefined,
      status: undefined,
      service: undefined,
      assignee: undefined,
      followUp: undefined,
    });
  });

  it("only assigns leads to active staff who manage inquiries, and audits real changes", async () => {
    const lead = await mk("foxtrot");
    await expect(leads.updateInquiry(lead.id, { status: "CONTACTED", assignedToId: student.id, followUpDay: null }, admin)).rejects.toThrow(/active staff/);
    await leads.updateInquiry(lead.id, { status: "CONTACTED", assignedToId: cm.id, followUpDay: "2026-12-01" }, admin);
    const after = await db().inquiry.findUniqueOrThrow({ where: { id: lead.id } });
    expect(after.status).toBe("CONTACTED");
    expect(after.assignedToId).toBe(cm.id);
    expect(pkDay(after.followUpAt!)).toBe("2026-12-01");
    // Saving again without changes writes no extra audit entry.
    await leads.updateInquiry(lead.id, { status: "CONTACTED", assignedToId: cm.id, followUpDay: "2026-12-01" }, admin);
    const logs = await db().auditLog.findMany({ where: { entityId: lead.id, action: "inquiry.updated" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.metadata).toMatchObject({ status: { from: "NEW", to: "CONTACTED" } });
  });

  it("keeps notes in order and deletes leads with their notes", async () => {
    const lead = await mk("golf");
    await leads.addNote(lead.id, "First call", admin);
    await leads.addNote(lead.id, "Sent proposal", cm);
    await expect(leads.addNote(lead.id, "   ", admin)).rejects.toThrow();
    const full = await leads.getInquiry(lead.id);
    expect(full?.notes.map((n) => [n.body, n.author?.name])).toEqual([["First call", "Admin"], ["Sent proposal", "Content"]]);
    await leads.deleteInquiry(lead.id, admin);
    expect(await db().inquiry.count({ where: { id: lead.id } })).toBe(0);
    expect(await db().inquiryNote.count({ where: { inquiryId: lead.id } })).toBe(0);
    expect(await db().auditLog.count({ where: { entityId: lead.id, action: "inquiry.deleted" } })).toBe(1);
  });
});
