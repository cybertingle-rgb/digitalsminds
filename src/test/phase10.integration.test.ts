/**
 * Announcements, support tickets, certificates, newsletter and notifications
 * against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/mailer", () => ({ sendMail: async (m: { to: string; subject: string; text: string }) => void sent.push(m) }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("phase 10 (integration)", async () => {
  const { db } = await import("@/lib/db");
  const ann = await import("@/modules/announcements/service");
  const support = await import("@/modules/support/service");
  const certs = await import("@/modules/certificates/service");
  const news = await import("@/modules/newsletter/service");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const teach = { id: id("teach"), role: "INSTRUCTOR" as const };
  const other = { id: id("other"), role: "INSTRUCTOR" as const };
  let course = "";
  let otherCourse = "";

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: id("sa"), name: "Admin", email: `sa.${tag}@example.com`, role: "SUPER_ADMIN" },
        { id: id("cm"), name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: id("teach"), name: "Teacher", email: `teach.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: id("other"), name: "Other", email: `other.${tag}@example.com`, role: "INSTRUCTOR" },
        { id: id("s1"), name: "Student One", email: `s1.${tag}@example.com`, role: "STUDENT" },
        { id: id("s2"), name: "Student Two", email: `s2.${tag}@example.com`, role: "STUDENT" },
      ],
    });
    course = (await db().course.create({
      data: { slug: `t${tag}-c`, title: "Course", summary: "Summary text", language: "en", status: "PUBLISHED", createdById: id("sa"), instructors: { create: { userId: id("teach") } } },
    })).id;
    otherCourse = (await db().course.create({ data: { slug: `t${tag}-o`, title: "Other", summary: "Summary text", language: "en", status: "PUBLISHED", createdById: id("sa") } })).id;
    await db().enrollment.createMany({
      data: [
        { userId: id("s1"), courseId: course, status: "APPROVED", completedAt: new Date() },
        { userId: id("s2"), courseId: otherCourse, status: "APPROVED" },
      ],
    });
  });

  afterAll(async () => {
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().certificate.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().announcement.deleteMany({ where: { authorId: { startsWith: `t${tag}` } } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().newsletterSubscriber.deleteMany({ where: { email: { endsWith: `${tag}@news.test` } } });
    await db().verification.deleteMany({ where: { identifier: { endsWith: `${tag}@news.test` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().$disconnect();
  });

  it("announces to a course's students only, with permission checks and a one-time email", async () => {
    await expect(ann.createAnnouncement({ courseId: null, title: "Everyone", body: "Hello all", sendEmail: false }, teach)).rejects.toThrow(/Only Super Admins/);
    await expect(ann.createAnnouncement({ courseId: otherCourse, title: "Not mine", body: "Hello", sendEmail: false }, teach)).rejects.toThrow(/not found/);
    const { announcement, recipients } = await ann.createAnnouncement({ courseId: course, title: "Live class", body: "Join us on Friday", sendEmail: true }, teach);
    expect(recipients).toBe(1);
    expect(await db().notification.count({ where: { userId: id("s1"), type: "ANNOUNCEMENT" } })).toBe(1);
    expect(await db().notification.count({ where: { userId: id("s2"), type: "ANNOUNCEMENT" } })).toBe(0);
    sent.length = 0;
    expect(await ann.sendAnnouncementEmails(announcement.id)).toEqual({ sent: 1, failed: 0 });
    expect(await ann.sendAnnouncementEmails(announcement.id)).toEqual({ sent: 0, failed: 0 });
    expect(sent.map((m) => m.to)).toEqual([`s1.${tag}@example.com`]);
    expect((await ann.studentAnnouncements(id("s1"))).map((a) => a.title)).toContain("Live class");
    expect((await ann.studentAnnouncements(id("s2"))).map((a) => a.title)).not.toContain("Live class");
  });

  it("scopes support tickets to course instructors and hides internal notes from students", async () => {
    await expect(support.createTicket(id("s2"), { subject: "Help", courseId: course, message: "x" })).rejects.toThrow("course");
    const t = await support.createTicket(id("s1"), { subject: "Video won't play", courseId: course, message: "It says no access" });
    const general = await support.createTicket(id("s2"), { subject: "Account", courseId: null, message: "Change my email" });
    const ids = async (actor: Parameters<typeof support.listTickets>[0]) => (await support.listTickets(actor, { status: "ACTIVE" }, 1, 50)).items.map((i) => i.id);
    expect(await ids(teach)).toEqual([t.id]);
    expect(await ids(other)).toEqual([]);
    expect(await ids(cm)).toEqual(expect.arrayContaining([t.id, general.id]));
    expect(await support.staffTicket(general.id, teach)).toBeNull();

    sent.length = 0;
    await support.staffReply(t.id, "Internal: check Drive sharing", true, teach);
    expect(sent).toHaveLength(0);
    await support.staffReply(t.id, "We've shared it again, please retry.", false, teach);
    expect(sent.map((m) => m.to)).toEqual([`s1.${tag}@example.com`]);
    expect((await db().supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("AWAITING_STUDENT");
    const mine = (await support.studentTicket(t.id, id("s1")))!;
    expect(mine.messages.map((m) => m.body)).toEqual(["It says no access", "We've shared it again, please retry."]);
    expect(await support.studentTicket(t.id, id("s2"))).toBeNull();

    await support.studentReply(t.id, id("s1"), "Works now, thanks");
    expect((await db().supportTicket.findUniqueOrThrow({ where: { id: t.id } })).status).toBe("OPEN");
    await support.setTicketStatus(t.id, "CLOSED", teach);
    await expect(support.studentReply(t.id, id("s1"), "one more")).rejects.toThrow("closed");
    await expect(support.staffReply(t.id, "hello", false, teach)).rejects.toThrow(/Reopen/);
  });

  it("issues certificates after review, with unique codes, revocation and re-issue", async () => {
    await db().course.update({ where: { id: course }, data: { certificateEnabled: true } });
    const ready = await certs.readyToIssue();
    const mine = ready.filter((e) => e.userId.startsWith(`t${tag}`));
    expect(mine.map((e) => e.userId)).toEqual([id("s1")]);
    await expect(certs.issueCertificate(mine[0]!.id, teach)).rejects.toThrow(/permission/);
    const notDone = await db().enrollment.findFirstOrThrow({ where: { userId: id("s2") } });
    await expect(certs.issueCertificate(notDone.id, cm)).rejects.toThrow(/hasn't completed/);

    const cert = await certs.issueCertificate(mine[0]!.id, cm);
    expect(cert.code).toMatch(/^DM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(cert.recipientName).toBe("Student One");
    await expect(certs.issueCertificate(mine[0]!.id, cm)).rejects.toThrow(/already issued/);
    expect((await certs.readyToIssue()).some((e) => e.userId === id("s1"))).toBe(false);
    expect(certs.normaliseCode(cert.code.toLowerCase().replace(/-/g, " "))).toBe(cert.code);
    expect(certs.normaliseCode("DM-OOOO-1111")).toBeNull();

    await certs.revokeCertificate(cert.id, cm);
    expect((await certs.certificateByCode(cert.code))?.revokedAt).toBeInstanceOf(Date);
    expect((await certs.readyToIssue()).some((e) => e.userId === id("s1"))).toBe(true);
    const again = await certs.issueCertificate(mine[0]!.id, cm);
    expect(again.code).not.toBe(cert.code);
    expect(await certs.certificateByCode(cert.code)).toBeNull();
    expect(await db().notification.count({ where: { userId: id("s1"), type: "CERTIFICATE_ISSUED" } })).toBe(2);
  });

  it("subscribes only after email confirmation, without revealing existing subscribers", async () => {
    const email = `reader.${tag}@news.test`;
    sent.length = 0;
    await news.requestSubscription({ email, locale: "en", source: "/" });
    expect(await db().newsletterSubscriber.count({ where: { email } })).toBe(0);
    // A second request within 10 minutes doesn't send another email.
    await news.requestSubscription({ email, locale: "en", source: "/" });
    expect(sent).toHaveLength(1);
    const token = sent[0]!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!;
    expect(await news.pendingEmail(token)).toBe(email);
    expect(await news.confirmSubscription("x".repeat(43))).toBe(false);
    expect(await news.confirmSubscription(token)).toBe(true);
    expect(await news.confirmSubscription(token)).toBe(false);
    const sub = await db().newsletterSubscriber.findUniqueOrThrow({ where: { email } });
    expect(sub.status).toBe("SUBSCRIBED");
    sent.length = 0;
    await news.requestSubscription({ email, locale: "en" });
    expect(sent).toHaveLength(0);
    expect(await news.unsubscribe(sub.unsubscribeToken)).toBe(true);
    expect((await db().newsletterSubscriber.findUniqueOrThrow({ where: { email } })).status).toBe("UNSUBSCRIBED");
  });
});
