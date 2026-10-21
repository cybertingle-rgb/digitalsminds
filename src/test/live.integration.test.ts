/**
 * Live classes against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mailer", () => ({ sendMail: async (m: { to: string; subject: string }) => void sent.push(m) }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("live classes (integration)", async () => {
  const { db } = await import("@/lib/db");
  const live = await import("@/modules/live/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const teach = { id: id("teach"), role: "INSTRUCTOR" as const };
  const other = { id: id("other"), role: "INSTRUCTOR" as const };
  let course = "";
  let draft = "";
  const inDays = (d: number) => {
    const t = new Date(Date.now() + d * 24 * 3600_000);
    return live.pkParts(t);
  };
  const base = (over: Record<string, unknown> = {}) =>
    live.liveClassInput.parse({ courseId: course, title: "Live Q&A", description: "", ...inDays(3), durationMinutes: "60", meetingUrl: "https://meet.google.com/abc-defg-hij", ...over });

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: teach.id, name: "Teacher", email: `teach.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: other.id, name: "Other", email: `other.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: id("s1"), name: "Student One", email: `s1.${tag}@example.com`, role: "STUDENT" },
        { id: id("s2"), name: "Waiting", email: `s2.${tag}@example.com`, role: "STUDENT" },
      ],
    });
    course = (await db().course.create({ data: { slug: `t${tag}-c`, title: "eBay Selling", summary: "Sell", language: "en", status: "PUBLISHED", createdById: cm.id } })).id;
    draft = (await db().course.create({ data: { slug: `t${tag}-d`, title: "Draft", summary: "Draft", language: "en", createdById: cm.id } })).id;
    await db().courseInstructor.create({ data: { courseId: course, userId: teach.id } });
    await db().enrollment.createMany({
      data: [
        { userId: id("s1"), courseId: course, status: "APPROVED" },
        { userId: id("s2"), courseId: course, status: "REQUESTED" },
      ],
    });
  });

  afterAll(async () => {
    await db().liveClass.deleteMany({ where: { courseId: { in: [course, draft] } } });
    await db().notification.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().courseInstructor.deleteMany({ where: { courseId: course } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("validates meeting links and reads times as Pakistan time", () => {
    expect(() => base({ meetingUrl: "http://zoom.us/j/1" })).toThrow(/Zoom, Google Meet or Teams/);
    expect(() => base({ meetingUrl: "https://evil.example/zoom.us" })).toThrow(/Zoom, Google Meet or Teams/);
    expect(base({ meetingUrl: "https://us02web.zoom.us/j/123?pwd=x" }).meetingUrl).toContain("zoom.us");
    expect(live.liveClassInput.parse({ courseId: "x", title: "abc", date: "2026-11-01", time: "18:30", durationMinutes: 60, meetingUrl: "https://meet.google.com/a" }).startsAt.toISOString()).toBe("2026-11-01T13:30:00.000Z");
    expect(live.pkParts(new Date("2026-11-01T13:30:00Z"))).toEqual({ date: "2026-11-01", time: "18:30" });
  });

  it("only course staff schedule, in the future, on published courses", async () => {
    await expect(live.createLiveClass(base(), other)).rejects.toThrow(/courses you manage/);
    await expect(live.createLiveClass(base({ courseId: draft }), cm)).rejects.toThrow(/Publish the course/);
    await expect(live.createLiveClass(base({ ...inDays(-1) }), teach)).rejects.toThrow();
    const c = await live.createLiveClass(base(), teach);
    expect(c.status).toBe("SCHEDULED");
    // Approved students get an in-app notice (no email for a new class); waiting students don't.
    expect(await db().notification.count({ where: { userId: id("s1"), title: { contains: "New live class: Live Q&A" } } })).toBe(1);
    expect(await db().notification.count({ where: { userId: id("s2") } })).toBe(0);
  });

  it("students see classes only for courses they're approved in; the calendar file is valid", async () => {
    expect((await live.studentLiveClasses(id("s1"))).upcoming.map((c) => c.title)).toEqual(["Live Q&A"]);
    expect((await live.studentLiveClasses(id("s2"))).upcoming).toEqual([]);
    const c = await db().liveClass.findFirstOrThrow({ where: { courseId: course } });
    expect(await live.liveClassForViewer(c.id, { id: id("s2"), role: "STUDENT" })).toBeNull();
    expect(await live.liveClassForViewer(c.id, other)).toBeNull();
    const v = (await live.liveClassForViewer(c.id, { id: id("s1"), role: "STUDENT" }))!;
    const ics = live.liveClassIcs(v);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain(`DTSTART:${c.startsAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
    expect(ics).toContain("SUMMARY:Live Q&A (eBay Selling)");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });

  it("sends the 1-day and 1-hour reminders once each, and again after a time change", async () => {
    const c = await db().liveClass.findFirstOrThrow({ where: { courseId: course } });
    const at = (msBefore: number) => new Date(c.startsAt.getTime() - msBefore);
    expect(await live.sendDueReminders(at(30 * 3600_000))).toEqual([]);
    const before = sent.length;
    expect(await live.sendDueReminders(at(20 * 3600_000))).toEqual([{ id: c.id, kind: "day" }]);
    expect(await live.sendDueReminders(at(19 * 3600_000))).toEqual([]);
    expect(await live.sendDueReminders(at(45 * 60_000))).toEqual([{ id: c.id, kind: "hour" }]);
    expect(await live.sendDueReminders(at(30 * 60_000))).toEqual([]);
    const mails = sent.slice(before);
    expect(mails.map((m) => m.to)).toEqual([`s1.${tag}@example.com`, `s1.${tag}@example.com`]);
    expect(mails[0]!.subject).toMatch(/^Reminder: Live Q&A starts /);
    expect(mails[1]!.subject).toBe("Starting in 1 hour: Live Q&A");

    // Moving the class tells students and re-arms the reminders.
    await expect(live.updateLiveClass(c.id, base({ title: "Live Q&A" }), other)).rejects.toThrow(/courses you manage/);
    await live.updateLiveClass(c.id, base({ ...inDays(4) }), teach);
    expect(await db().liveClass.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ reminderDaySentAt: null, reminderHourSentAt: null });
    expect(sent.some((m) => m.subject.startsWith("Live class moved: Live Q&A"))).toBe(true);
  });

  it("cancelling tells students, and cancelled classes get no reminders", async () => {
    const c = await db().liveClass.findFirstOrThrow({ where: { courseId: course } });
    await live.cancelLiveClass(c.id, cm);
    expect(sent.some((m) => m.subject === "Live class cancelled: Live Q&A (eBay Selling)")).toBe(true);
    expect(await live.sendDueReminders(new Date(c.startsAt.getTime() - 30 * 60_000))).toEqual([]);
    expect(live.liveState({ ...c, status: "CANCELLED" })).toBe("cancelled");
    expect(live.liveState({ ...c, status: "SCHEDULED" }, c.startsAt.getTime() - 10 * 60_000)).toBe("live");
    expect(live.liveState({ ...c, status: "SCHEDULED" }, c.startsAt.getTime() - 20 * 60_000)).toBe("upcoming");
    expect(await db().auditLog.count({ where: { action: { startsWith: "live." }, actorId: { in: [cm.id, teach.id] } } })).toBe(3);
  });
});
