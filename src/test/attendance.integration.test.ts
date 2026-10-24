/**
 * Attendance and batch time zones against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mailer", () => ({ sendMail: async () => {} }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("attendance and time zones (integration)", async () => {
  const { db } = await import("@/lib/db");
  const att = await import("@/modules/attendance/service");
  const live = await import("@/modules/live/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const coord = { id: id("coord"), role: "INSTRUCTOR" as const };
  const other = { id: id("other"), role: "INSTRUCTOR" as const };
  let course = "";
  let batch = "";
  let pastClass = "";
  let futureClass = "";
  let holiday = "";
  const enr: Record<string, string> = {};

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: coord.id, name: "Coord", email: `coord.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: other.id, name: "Other", email: `other.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: id("s1"), name: "Amna", email: `s1.${tag}@example.com`, role: "STUDENT" },
        { id: id("s2"), name: "Bilal", email: `s2.${tag}@example.com`, role: "STUDENT" },
        { id: id("s3"), name: "Outsider", email: `s3.${tag}@example.com`, role: "STUDENT" },
      ],
    });
    course = (await db().course.create({ data: { slug: `t${tag}-c`, title: "Amazon FBA", summary: "Sell", language: "en", status: "PUBLISHED", createdById: cm.id } })).id;
    batch = (
      await db().batch.create({
        data: { courseId: course, name: "UK Batch", code: `UK${tag}`.toUpperCase(), status: "IN_PROGRESS", startDate: new Date(), scheduleText: "Sat 10 am", capacity: 10, coordinatorId: coord.id, timeZone: "Europe/London", attendanceEnabled: true },
      })
    ).id;
    const otherBatch = await db().batch.create({ data: { courseId: course, name: "Other", code: `OT${tag}`.toUpperCase(), status: "IN_PROGRESS", startDate: new Date(), scheduleText: "x", capacity: 10 } });
    for (const [k, b] of [["s1", batch], ["s2", batch], ["s3", otherBatch.id]] as const) {
      enr[k] = (await db().enrollment.create({ data: { userId: id(k), courseId: course, batchId: b, status: "APPROVED", stage: "ACTIVE" } })).id;
    }
    const mk = (title: string, hoursFromNow: number, kind: "CLASS" | "HOLIDAY" = "CLASS") =>
      db().liveClass.create({ data: { courseId: course, batchId: batch, title, kind, startsAt: new Date(Date.now() + hoursFromNow * 3600_000), durationMinutes: 60 } });
    pastClass = (await mk("Week 1", -48)).id;
    futureClass = (await mk("Week 3", 48)).id;
    holiday = (await mk("Bank holiday", -24, "HOLIDAY")).id;
  });

  afterAll(async () => {
    await db().liveClass.deleteMany({ where: { courseId: course } });
    await db().notification.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().batch.deleteMany({ where: { courseId: course } });
    await db().course.deleteMany({ where: { id: course } });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("schedules classes in the batch's own time zone", async () => {
    const raw = { batchId: batch, kind: "CLASS", title: "Summer class", date: "2099-07-01", time: "09:00", durationMinutes: "60", meetingUrl: "" };
    const c = await live.createLiveClass(live.liveClassInput.parse(raw), coord);
    // 09:00 British Summer Time = 08:00 UTC.
    expect(c.startsAt.toISOString()).toBe("2099-07-01T08:00:00.000Z");
    await live.updateLiveClass(c.id, live.liveClassInput.parse({ ...raw, date: "2099-12-01" }), coord);
    expect((await db().liveClass.findUniqueOrThrow({ where: { id: c.id } })).startsAt.toISOString()).toBe("2099-12-01T09:00:00.000Z");
    await db().liveClass.delete({ where: { id: c.id } });
  });

  it("lists the classes so far, never future classes or holidays", async () => {
    const o = await att.batchAttendance(batch, coord);
    expect(o.classes.map((c) => c.id)).toEqual([pastClass]);
    expect(o.students).toBe(2);
    await expect(att.batchAttendance(batch, other)).rejects.toThrow(/not found/);
    await expect(att.attendanceSheet(batch, futureClass, coord)).rejects.toThrow(/not started/);
    await expect(att.attendanceSheet(batch, holiday, coord)).rejects.toThrow(/not one that takes attendance/);
  });

  it("the coordinator marks the register; outsiders and other batches are refused", async () => {
    const sheet = await att.attendanceSheet(batch, pastClass, coord);
    expect(sheet.rows.map((r) => r.user.name)).toEqual(["Amna", "Bilal"]);
    await expect(att.saveAttendance(batch, pastClass, [{ enrollmentId: enr.s3!, status: "PRESENT", note: null }], coord)).rejects.toThrow(/isn't in this batch/);
    await expect(att.saveAttendance(batch, pastClass, [{ enrollmentId: enr.s1!, status: "PRESENT", note: null }], other)).rejects.toThrow(/not found/);
    await expect(att.saveAttendance(batch, futureClass, [{ enrollmentId: enr.s1!, status: "PRESENT", note: null }], coord)).rejects.toThrow(/not started/);
    await att.saveAttendance(batch, pastClass, att.marksInput.parse([{ enrollmentId: enr.s1, status: "LATE", note: "10 min" }, { enrollmentId: enr.s2, status: "ABSENT" }]), coord);
    const again = await att.attendanceSheet(batch, pastClass, cm);
    expect(again.rows.map((r) => [r.user.name, r.status, r.note])).toEqual([["Amna", "LATE", "10 min"], ["Bilal", "ABSENT", null]]);
    // Clearing a mark removes it.
    await att.saveAttendance(batch, pastClass, att.marksInput.parse([{ enrollmentId: enr.s2, status: "" }]), coord);
    expect(await db().attendance.count({ where: { liveClassId: pastClass } })).toBe(1);
    expect(() => att.marksInput.parse([{ enrollmentId: enr.s1, status: "SLEEPING" }])).toThrow();
  });

  it("students see only their own record, with excused classes not counted", async () => {
    const a1 = await att.studentAttendance(id("s1"));
    expect(a1.marks.get(pastClass)).toBe("LATE");
    expect(a1.summary.get(enr.s1!)).toEqual({ attended: 1, total: 1 });
    const a2 = await att.studentAttendance(id("s2"));
    expect(a2.marks.size).toBe(0);
    await att.saveAttendance(batch, pastClass, att.marksInput.parse([{ enrollmentId: enr.s2, status: "EXCUSED" }]), coord);
    expect((await att.studentAttendance(id("s2"))).summary.get(enr.s2!)).toEqual({ attended: 0, total: 0 });
  });

  it("can't record when attendance is switched off, but keeps earlier records", async () => {
    await db().batch.update({ where: { id: batch }, data: { attendanceEnabled: false } });
    await expect(att.saveAttendance(batch, pastClass, [{ enrollmentId: enr.s1!, status: "PRESENT", note: null }], coord)).rejects.toThrow(/switched off/);
    expect((await att.attendanceSheet(batch, pastClass, coord)).rows[0]!.status).toBe("LATE");
    // Students don't see records from a batch where it's off.
    expect((await att.studentAttendance(id("s1"))).marks.size).toBe(0);
  });
});
