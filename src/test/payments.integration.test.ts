/**
 * Paid courses and manual payments against a real database. Run with `npm run test:db`.
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mailer", () => ({ sendMail: async (m: { to: string; subject: string }) => void sent.push(m) }));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;
const uploads = mkdtempSync(path.join(os.tmpdir(), "dm-pay-"));
process.env.UPLOAD_DIR = uploads;

run("paid courses (integration)", async () => {
  const { db } = await import("@/lib/db");
  const pay = await import("@/modules/payments/service");
  const enroll = await import("@/modules/learning/enrollment");
  const { fileExists } = await import("@/lib/storage/local");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const sa = { id: id("sa"), role: "SUPER_ADMIN" as const };
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const student = { id: id("s1"), name: "Ayesha" };
  let course = "";
  let savedDetails: unknown = null;
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#fdcf31" } }).png().toBuffer();
  const input = { method: "BANK_TRANSFER" as const, reference: "TX-123456", payerName: null, paidOn: "2026-10-20", googleEmail: "ayesha.g@gmail.com", note: null };

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: sa.id, name: "Admin", email: `sa.${tag}@example.com`, role: "SUPER_ADMIN" },
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: student.id, name: "Ayesha", email: `ayesha.${tag}@example.com`, role: "STUDENT" },
      ],
    });
    course = (await db().course.create({ data: { slug: `t${tag}-ebay`, title: "eBay Selling", summary: "Sell on eBay", language: "en", status: "PUBLISHED", createdById: sa.id } })).id;
    savedDetails = (await db().siteSetting.findUnique({ where: { key: "site.payments" } }))?.value ?? null;
  });

  afterAll(async () => {
    await db().payment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().notification.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().enrollment.deleteMany({ where: { userId: { startsWith: `t${tag}` } } });
    await db().course.deleteMany({ where: { slug: { startsWith: `t${tag}` } } });
    await db().auditLog.deleteMany({ where: { actorId: { startsWith: `t${tag}` } } });
    await db().user.deleteMany({ where: { id: { startsWith: `t${tag}` } } });
    await db().siteSetting.deleteMany({ where: { key: "site.payments" } });
    if (savedDetails) await db().siteSetting.create({ data: { key: "site.payments", value: savedDetails as object } });
    await db().$disconnect();
    rmSync(uploads, { recursive: true, force: true });
  });

  it("formats rupees", () => {
    expect(pay.formatPkr(1_500_000)).toBe("Rs 15,000");
    expect(pay.formatPkr(1_250_050)).toBe("Rs 12,500.50");
  });

  it("only Super Admins set prices and payment details", async () => {
    await expect(pay.setCoursePrice(course, { paid: true, pricePkr: 15000 }, cm)).rejects.toThrow(/Super Admins/);
    await expect(pay.setCoursePrice(course, pay.priceInput.parse({ paid: true, pricePkr: "" }), sa)).rejects.toThrow();
    expect(() => pay.priceInput.parse({ paid: true, pricePkr: "50" })).toThrow(/Rs 100/);
    await pay.setCoursePrice(course, pay.priceInput.parse({ paid: true, pricePkr: "15,000" }), sa);
    expect(await db().course.findUniqueOrThrow({ where: { id: course } })).toMatchObject({ accessType: "PAID", priceAmount: 1_500_000, currency: "PKR" });
    await expect(pay.savePaymentDetails({ bankAccountNumber: "123" }, cm)).rejects.toThrow(/Super Admins/);
    await pay.savePaymentDetails({ bankName: "Meezan", bankAccountTitle: "Digitals Minds", bankAccountNumber: "PK00TEST0000000000000000" }, sa);
    expect(pay.availableMethods(await pay.getPaymentDetails())).toEqual(["BANK_TRANSFER"]);
  });

  it("paid courses can't be joined with a free request", async () => {
    await expect(enroll.requestEnrollment(student, course, { googleEmail: "a@gmail.com", note: null })).rejects.toThrow("paymentRequired");
  });

  it("checks the method and the receipt", async () => {
    await expect(pay.submitPayment(student, course, { ...input, method: "JAZZCASH" }, { data: png, name: "r.png" })).rejects.toThrow("methodUnavailable");
    await expect(pay.submitPayment(student, course, input, { data: Buffer.from("<svg onload=alert(1)>hello world</svg>"), name: "r.svg" })).rejects.toThrow("receiptType");
    expect(() => pay.submitInput.parse({ ...input, paidOn: "2099-01-01" })).toThrow();
  });

  it("records a payment, keeps the receipt private, and blocks a second one while waiting", async () => {
    const p = await pay.submitPayment(student, course, input, { data: png, name: "My Receipt.PNG" });
    expect(p).toMatchObject({ status: "PENDING", amount: 1_500_000, method: "BANK_TRANSFER", receiptMime: "image/png" });
    expect(p.receiptKey).toMatch(/^receipts\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);
    expect(await fileExists(p.receiptKey!)).toBe(true);
    expect((await enroll.enrollmentFor(student.id, course))?.status).toBe("REQUESTED");
    expect((await db().user.findUniqueOrThrow({ where: { id: student.id } })).googleEmail).toBe("ayesha.g@gmail.com");
    expect(sent.some((m) => m.to === `ayesha.${tag}@example.com` && /received your payment details/.test(m.subject))).toBe(true);
    expect(sent.some((m) => m.to === `sa.${tag}@example.com` && /Payment to check/.test(m.subject))).toBe(true);
    await expect(pay.submitPayment(student, course, input, { data: png, name: "r.png" })).rejects.toThrow("alreadySubmitted");

    // Receipts: the payer and payment staff only.
    expect(await pay.receiptFor(p.id, { id: student.id, role: "STUDENT" })).not.toBeNull();
    expect(await pay.receiptFor(p.id, cm)).not.toBeNull();
    expect(await pay.receiptFor(p.id, { id: id("other"), role: "STUDENT" })).toBeNull();
    expect(await pay.receiptFor(p.id, { id: id("teach"), role: "INSTRUCTOR" })).toBeNull();
  });

  it("only payments open a paid course; Content Managers can't approve it", async () => {
    const e = (await enroll.enrollmentFor(student.id, course))!;
    await expect(enroll.decideEnrollment(e.id, "APPROVED", null, cm)).rejects.toThrow(/paid course/);
    await expect(enroll.manualEnroll(student.id, course, cm)).rejects.toThrow(/paid course/);
  });

  it("rejecting tells the student why; they can pay again; confirming opens the course", async () => {
    const first = (await db().payment.findFirstOrThrow({ where: { userId: student.id, status: "PENDING" } })).id;
    await expect(pay.rejectPayment(first, "x", sa)).rejects.toThrow(/why/);
    await expect(pay.confirmPayment(first, cm)).rejects.toThrow(/Super Admins/);
    await pay.rejectPayment(first, "We couldn't find this transaction.", sa);
    const e = (await enroll.enrollmentFor(student.id, course))!;
    expect(e).toMatchObject({ status: "REJECTED", decisionNote: "Payment not confirmed: We couldn't find this transaction." });
    await expect(pay.confirmPayment(first, sa)).rejects.toThrow(/already handled/);

    const second = await pay.submitPayment(student, course, { ...input, reference: "TX-999" }, { data: png, name: "r2.png" });
    expect((await enroll.enrollmentFor(student.id, course))?.status).toBe("REQUESTED");
    await pay.confirmPayment(second.id, sa);
    expect((await db().payment.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("CONFIRMED");
    expect((await enroll.enrollmentFor(student.id, course))?.status).toBe("APPROVED");
    await expect(pay.submitPayment(student, course, input, { data: png, name: "r3.png" })).rejects.toThrow("alreadyEnrolled");
    const latest = await pay.latestPaymentsFor(student.id);
    expect(latest.get(course)?.status).toBe("CONFIRMED");
    expect(await db().auditLog.count({ where: { action: { in: ["payment.submitted", "payment.confirmed", "payment.rejected"] }, actorId: { in: [sa.id, student.id] } } })).toBe(4);
  });
});
