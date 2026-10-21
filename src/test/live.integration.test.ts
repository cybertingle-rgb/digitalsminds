/**
 * Batch schedules (classes, holidays, events) against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mailer", () => ({ sendMail: async (m: { to: string; subject: string }) => void sent.push(m) }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("batch schedule (integration)", async () => {
  const { db } = await import("@/lib/db");
  const live = await import("@/modules/live/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const coord = { id: id("coord"), role: "INSTRUCTOR" as const };
  const other = { id: id("other"), role: "INSTRUCTOR" as const };
  let course = "";
  let batch = "";
  let otherBatch = "";
  const inDays = (d: number) => live.pkParts(new Date(Date.now() + d * 24 * 3600_000));
  const base = (over: Record<string, unknown> = {}) =>
    live.liveClassInput.parse({ batchId: batch, kind: "CLASS", title: "Week 1", description: "", ...inDays(3), durationMinutes: "60", meetingUrl: "", ...over });

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: coord.id, name: "Coordinator", email: `coord.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: other.id, name: "Other", email: `other.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: id("s1"), name: "Student One", email: `s1.${tag}@example.com`, role: "STUDENT" },
        { id: id("s2"), name: "Other Batch", email: `s2.${tag}@example.com`, role: "STUDENT" },
        { id: id("s3"), name: "Withdrawn", email: `s3.${tag}@example.com`, role: "STUDENT" },
      ],
    });
    course = (await db().course.create({ data: { slug: `t${tag}-c`, title: "eBay Selling", summary: "Sell", language: "en", status: "PUBLISHED", createdById: cm.id } })).id;
    const mk = (code: string, coordinatorId: string | null) =>
      db().batch.create({ data: { courseId: course, name: `Batch ${code}`, code: `${code}${tag}`.toUpperCase(), status: "IN_PROGRESS", startDate: new Date(), scheduleText: "Mon 8 pm", capacity: 10, meetingUrl: "https://meet.google.com/abc-defg-hij", coordinatorId } });
    batch = (await mk("A", coord.id)).id;
    otherBatch = (await mk("B", other.id)).id;
    await db().enrollment.createMany({
      data: [
        { userId: id("s1"), courseId: course, batchId: batch, status: "APPROVED", stage: "ACTIVE" },
        { userId: id("s2"), courseId: course, batchId: otherBatch, status: "APPROVED", stage: "ACTIVE" },
      ],
    });
    // A withdrawn student of the same batch (different program row is not possible, so a second course).
    const c2 = await db().course.create({ data: { slug: `t${tag}-c2`, title: "Other", summary: "Other", language: "en", status: "PUBLISHED", createdById: cm.id } });
    await db().enrollment.create({ data: { userId: id("s3"), courseId: c2.id, batchId: batch, status: "REVOKED", stage: "WITHDRAWN" } });
  });

  afterAll(async () => {
    await db().liveClass.deleteMany({ where: { batchId: { in: [batch, otherBatch] } } });
    await db().notification.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().batch.deleteMany({ where: { id: { in: [batch, otherBatch] } } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("validates input and reads times as Pakistan time", () => {
    expect(() => base({ meetingUrl: "http://zoom.us/j/1" })).toThrow(/Zoom, Google Meet or Teams/);
    expect(() => base({ meetingUrl: "https://evil.example/zoom.us" })).toThrow(/Zoom, Google Meet or Teams/);
    expect(() => base({ time: "" })).toThrow(/Choose a time/);
    expect(base({ date: "2026-11-01", time: "18:30" }).startsAt.toISOString()).toBe("2026-11-01T13:30:00.000Z");
    // A holiday is the whole day, with no time, length or link.
    const h = base({ kind: "HOLIDAY", date: "2026-11-01", time: "", durationMinutes: "", meetingUrl: "https://zoom.us/j/1" });
    expect([h.startsAt.toISOString(), h.durationMinutes, h.meetingUrl]).toEqual(["2026-10-31T19:00:00.000Z", 1440, null]);
  });

  it("only the batch's coordinator and managers schedule, and only its current students are told", async () => {
    await expect(live.createLiveClass(base(), other)).rejects.toThrow(/batches you manage or coordinate/);
    await expect(live.createLiveClass(base({ ...inDays(-1) }), coord)).rejects.toThrow();
    const c = await live.createLiveClass(base(), coord);
    expect([c.status, c.courseId, c.meetingUrl]).toEqual(["SCHEDULED", course, null]);
    expect(await db().notification.count({ where: { userId: id("s1"), title: { contains: "New on your schedule: Week 1" } } })).toBe(1);
    expect(await db().notification.count({ where: { userId: { in: [id("s2"), id("s3")] } } })).toBe(0);
  });

  it("students see their own batch's schedule, with the batch link as the default", async () => {
    const mine = await live.studentLiveClasses(id("s1"));
    expect(mine.upcoming.map((c) => [c.title, c.meetingUrl])).toEqual([["Week 1", "https://meet.google.com/abc-defg-hij"]]);
    expect((await live.studentLiveClasses(id("s2"))).upcoming).toEqual([]);
    expect((await live.studentLiveClasses(id("s3"))).upcoming).toEqual([]);
    const c = await db().liveClass.findFirstOrThrow({ where: { batchId: batch } });
    expect(await live.liveClassForViewer(c.id, { id: id("s2"), role: "STUDENT" })).toBeNull();
    expect(await live.liveClassForViewer(c.id, other)).toBeNull();
    const ics = live.liveClassIcs((await live.liveClassForViewer(c.id, { id: id("s1"), role: "STUDENT" }))!);
    expect(ics).toContain("SUMMARY:Week 1 (eBay Selling)");
    expect(ics).toContain("URL:https://meet.google.com/abc-defg-hij");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });

  it("sends class reminders once each, re-arms them after a time change, and never for holidays", async () => {
    const c = await db().liveClass.findFirstOrThrow({ where: { batchId: batch, kind: "CLASS" } });
    const at = (msBefore: number) => new Date(c.startsAt.getTime() - msBefore);
    expect(await live.sendDueReminders(at(30 * 3600_000))).toEqual([]);
    const before = sent.length;
    expect(await live.sendDueReminders(at(20 * 3600_000))).toEqual([{ id: c.id, kind: "day" }]);
    expect(await live.sendDueReminders(at(45 * 60_000))).toEqual([{ id: c.id, kind: "hour" }]);
    expect(await live.sendDueReminders(at(30 * 60_000))).toEqual([]);
    expect(sent.slice(before).map((m) => m.to)).toEqual([`s1.${tag}@example.com`, `s1.${tag}@example.com`]);

    await expect(live.updateLiveClass(c.id, base(), other)).rejects.toThrow(/batches you manage or coordinate/);
    await live.updateLiveClass(c.id, base({ ...inDays(4) }), coord);
    expect(await db().liveClass.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ reminderDaySentAt: null, reminderHourSentAt: null });
    expect(sent.some((m) => m.subject.startsWith("Schedule change: Week 1"))).toBe(true);

    const mails = sent.length;
    const h = await live.createLiveClass(base({ kind: "HOLIDAY", title: "Eid holiday", ...inDays(5), time: "", durationMinutes: "" }), cm);
    // A holiday is emailed straight away, and gets no reminders.
    expect(sent.slice(mails).map((m) => m.subject)).toEqual([expect.stringMatching(/^Holiday: Eid holiday on /)]);
    expect(await live.sendDueReminders(new Date(h.startsAt.getTime() - 30 * 60_000))).toEqual([]);
  });

  it("cancelling tells students, and cancelled classes get no reminders", async () => {
    const c = await db().liveClass.findFirstOrThrow({ where: { batchId: batch, kind: "CLASS" } });
    await live.cancelLiveClass(c.id, cm);
    expect(sent.some((m) => m.subject === "Cancelled: Week 1 (eBay Selling)")).toBe(true);
    expect(await live.sendDueReminders(new Date(c.startsAt.getTime() - 30 * 60_000))).toEqual([]);
    expect(live.liveState({ ...c, status: "SCHEDULED" }, c.startsAt.getTime() - 10 * 60_000)).toBe("live");
    expect(live.liveState({ ...c, status: "CANCELLED" })).toBe("cancelled");
  });
});
