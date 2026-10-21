/**
 * Fees, payment details, receipts and legacy payments against a real database. Run with `npm run test:db`.
 * The apply → pay → verify flow is covered in admissions.integration.test.ts.
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
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const sa = { id: id("sa"), role: "SUPER_ADMIN" as const };
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const student = { id: id("s1"), name: "Ayesha" };
  let course = "";
  let savedDetails: unknown = null;
  const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#fdcf31" } }).png().toBuffer();

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

  it("checks receipts by content and strips images", async () => {
    await expect(pay.prepareReceipt({ data: Buffer.from("<svg onload=alert(1)>hello world</svg>"), name: "r.svg" })).rejects.toThrow("receiptType");
    const out = await pay.prepareReceipt({ data: png, name: "My Receipt.PNG" });
    expect([out.mime, out.ext]).toEqual(["image/png", "png"]);
  });

  it("keeps receipts to payment staff and the student who paid", async () => {
    const p = await db().payment.create({
      data: { userId: student.id, courseId: course, amount: 1_500_000, method: "BANK_TRANSFER", reference: `TX-${tag}`, receiptKey: `receipts/${tag}.png`, receiptMime: "image/png", receiptSize: 10 },
    });
    expect(await pay.receiptFor(p.id, { id: student.id, role: "STUDENT" })).not.toBeNull();
    expect(await pay.receiptFor(p.id, cm)).not.toBeNull();
    expect(await pay.receiptFor(p.id, { id: id("other"), role: "STUDENT" })).toBeNull();
    expect(await pay.receiptFor(p.id, { id: id("teach"), role: "INSTRUCTOR" })).toBeNull();
    await db().payment.delete({ where: { id: p.id } });
  });

  it("still settles payments sent through the old per-course flow (Super Admins only)", async () => {
    const legacy = () =>
      db().payment.create({ data: { userId: student.id, courseId: course, amount: 1_500_000, method: "BANK_TRANSFER", reference: `OLD-${randomUUID().slice(0, 6)}` } });
    await db().enrollment.create({ data: { userId: student.id, courseId: course, status: "REQUESTED" } });
    const first = await legacy();
    await expect(pay.rejectPayment(first.id, "x", sa)).rejects.toThrow(/why/);
    await expect(pay.confirmPayment(first.id, cm)).rejects.toThrow(/Super Admins/);
    await pay.rejectPayment(first.id, "We couldn't find this transaction.", sa);
    expect(await enroll.enrollmentFor(student.id, course)).toMatchObject({ status: "REJECTED", decisionNote: "Payment not confirmed: We couldn't find this transaction." });
    await expect(pay.confirmPayment(first.id, sa)).rejects.toThrow(/already handled/);
    const second = await legacy();
    await pay.confirmPayment(second.id, sa);
    expect((await db().payment.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("CONFIRMED");
    expect((await enroll.enrollmentFor(student.id, course))?.status).toBe("APPROVED");
    expect((await pay.latestPaymentsFor(student.id)).get(course)?.status).toBe("CONFIRMED");
  });
});
