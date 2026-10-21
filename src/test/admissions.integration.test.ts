/**
 * Apply → pay → verify against a real database. Run with `npm run test:db`.
 * Covers the money and account rules: no account before a verified payment,
 * no double verification, no overbooking, no reused transaction IDs.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("admissions (integration)", async () => {
  const uploads = mkdtempSync(join(tmpdir(), "dm-admissions-"));
  process.env.UPLOAD_DIR = uploads;
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-1234";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { db } = await import("@/lib/db");
  const adm = await import("@/modules/admissions/service");
  const { hashToken } = await import("@/modules/admissions/rules");
  const tag = randomUUID().slice(0, 8);
  const id = (n: string) => `t${tag}_${n}`;
  const sa = { id: id("sa"), role: "SUPER_ADMIN" as const };
  const cm = { id: id("cm"), role: "CONTENT_MANAGER" as const };
  const pdf = (n = "") => ({ data: Buffer.from(`%PDF-1.4\n% test file ${n}\n%%EOF\n`), name: "file.pdf" });
  let courseId = "";
  let batchA = "";
  let batchB = "";
  let settingExisted = false;

  beforeAll(async () => {
    await db().user.createMany({
      data: [
        { id: sa.id, name: "Owner", email: `sa.${tag}@example.com`, role: "SUPER_ADMIN" },
        { id: cm.id, name: "Content", email: `cm.${tag}@example.com`, role: "CONTENT_MANAGER" },
        { id: id("old"), name: "Old Student", email: `old.${tag}@example.com`, role: "STUDENT", status: "SUSPENDED", suspendedAt: new Date() },
      ],
    });
    const c = await db().course.create({
      data: { slug: `t${tag}-ebay`, title: "eBay course", summary: "Summary text", language: "en", status: "PUBLISHED", accessType: "PAID", priceAmount: 1_500_000, currency: "PKR", createdById: sa.id },
    });
    courseId = c.id;
    const mk = (code: string, capacity: number) =>
      db().batch.create({ data: { courseId, name: `Batch ${code}`, code: `${code}${tag}`.toUpperCase(), status: "OPEN", startDate: new Date("2099-01-10T00:00:00Z"), scheduleText: "Mon 8 pm", capacity } });
    batchA = (await mk("A", 1)).id;
    batchB = (await mk("B", 5)).id;
    settingExisted = !!(await db().siteSetting.findUnique({ where: { key: "site.payments" } }));
    if (!settingExisted) await db().siteSetting.create({ data: { key: "site.payments", value: { jazzcashTitle: "DM", jazzcashNumber: "03000000000" } } });
  });

  afterAll(async () => {
    const apps = await db().enrollmentApplication.findMany({ where: { courseId }, select: { id: true } });
    await db().payment.deleteMany({ where: { courseId } });
    await db().enrollmentEvent.deleteMany({ where: { applicationId: { in: apps.map((a) => a.id) } } });
    await db().enrollmentApplication.deleteMany({ where: { courseId } });
    await db().notification.deleteMany({ where: { user: { email: { endsWith: `${tag}@example.com` } } } });
    await db().enrollment.deleteMany({ where: { courseId } });
    await db().batch.deleteMany({ where: { courseId } });
    await db().auditLog.deleteMany({ where: { OR: [{ actorId: { startsWith: `t${tag}` } }, { metadata: { path: "$.reference", string_contains: "DM-" } }] } });
    await db().verification.deleteMany({ where: { identifier: { startsWith: "reset-password:" }, value: { in: (await db().user.findMany({ where: { email: { endsWith: `${tag}@example.com` } }, select: { id: true } })).map((u) => u.id) } } });
    await db().course.delete({ where: { id: courseId } });
    await db().user.deleteMany({ where: { email: { endsWith: `${tag}@example.com` } } });
    if (!settingExisted) await db().siteSetting.delete({ where: { key: "site.payments" } });
    await db().$disconnect();
    rmSync(uploads, { recursive: true, force: true });
  });

  const apply = (email: string, batchId = batchA) =>
    adm.submitApplication(adm.applicationInput.parse({ batchId, name: "Sara Khan", email, phone: "0300 1234567", city: "Lahore", cnic: "3520212345671", acceptTerms: true }), pdf("cv"));

  /** Applies and returns the token by replacing the stored hash (the real token is only emailed). */
  async function applyWithToken(email: string, batchId = batchA) {
    const { reference } = await apply(email, batchId);
    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 11);
    const app = await db().enrollmentApplication.update({ where: { reference }, data: { tokenHash: hashToken(token) } });
    return { token, app };
  }
  const pay = (token: string, reference: string) =>
    adm.submitApplicationPayment(token, adm.paymentInput.parse({ method: "JAZZCASH", reference, paidOn: "2026-10-20" }), pdf("receipt"));
  const pendingPayment = async (applicationId: string) => (await db().payment.findFirstOrThrow({ where: { applicationId, status: "PENDING" } })).id;

  it("validates the form and refuses duplicates and staff emails", async () => {
    expect(adm.applicationInput.safeParse({ batchId: batchA, name: "Sara Khan", email: "x@example.com", phone: "0300 1234567", city: "Lahore", cnic: "12345", acceptTerms: true }).success).toBe(false);
    expect(adm.applicationInput.safeParse({ batchId: batchA, name: "Sara Khan", email: "x@example.com", phone: "0300 1234567", city: "Lahore", cnic: "3520212345671", acceptTerms: false }).success).toBe(false);
    const { reference } = await apply(`sara.${tag}@example.com`);
    const app = await db().enrollmentApplication.findUniqueOrThrow({ where: { reference } });
    expect([app.stage, app.cnic, app.feeAmount, app.userId]).toEqual(["APPLICATION_RECEIVED", "35202-1234567-1", 1_500_000, null]);
    expect(await db().user.count({ where: { email: `sara.${tag}@example.com` } })).toBe(0);
    await expect(apply(`SARA.${tag}@example.com`)).rejects.toThrow("alreadyApplied");
    await expect(apply(`sa.${tag}@example.com`)).rejects.toThrow("staffEmail");
    await expect(adm.submitApplication(adm.applicationInput.parse({ batchId: batchA, name: "Bad File", email: `bad.${tag}@example.com`, phone: "0300 1234567", city: "Lahore", cnic: "3520212345671", acceptTerms: true }), { data: Buffer.from("MZ not a pdf at all"), name: "cv.pdf" })).rejects.toThrow("cvType");
  });

  let bilal: { token: string; app: { id: string; email: string } };

  it("needs the emailed link before payment, and one payment at a time", async () => {
    const { token, app } = await applyWithToken(`ali.${tag}@example.com`);
    // A second applicant for the same one-seat batch, while it still has room.
    bilal = await applyWithToken(`bilal.${tag}@example.com`);
    await expect(pay(token, `TX-${tag}-1`)).rejects.toThrow("notAvailable");
    expect(await adm.confirmApplicationEmail("x".repeat(43))).toBe(false);
    expect(await adm.confirmApplicationEmail(token)).toBe(true);
    expect((await adm.applicationByToken(token))?.stage).toBe("PAYMENT_PENDING");
    await pay(token, `TX-${tag}-1`);
    await expect(pay(token, `TX-${tag}-2`)).rejects.toThrow("alreadySubmitted");
    // Another applicant can't claim the same (still unverified) transaction, however it's typed.
    await adm.confirmApplicationEmail(bilal.token);
    await expect(pay(bilal.token, ` tx ${tag} 1 `)).rejects.toThrow("referenceUsed");
    const view = await adm.applicationByToken(token);
    expect([view?.stage, view?.payments.length]).toEqual(["PAYMENT_SUBMITTED", 1]);
    // Still no account: a receipt alone unlocks nothing.
    expect(await db().user.count({ where: { email: app.email } })).toBe(0);
  });

  it("lets only Super Admins verify, in full, once; then creates the account and reserves the seat", async () => {
    const app = await db().enrollmentApplication.findFirstOrThrow({ where: { email: `ali.${tag}@example.com` } });
    const paymentId = await pendingPayment(app.id);
    await expect(adm.verifyPayment(paymentId, { amountReceivedPkr: 15000 }, cm)).rejects.toThrow(/Only Super Admins/);
    await expect(adm.verifyPayment(paymentId, { amountReceivedPkr: 14000 }, sa)).rejects.toThrow(/paid in full/);
    // Two clicks at the same moment: exactly one verification wins.
    const results = await Promise.allSettled([adm.verifyPayment(paymentId, { amountReceivedPkr: 15000 }, sa), adm.verifyPayment(paymentId, { amountReceivedPkr: 15000 }, sa)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const user = await db().user.findUniqueOrThrow({ where: { email: app.email } });
    expect([user.role, user.status, user.emailVerified, user.phone, user.city]).toEqual(["STUDENT", "ACTIVE", true, "0300 1234567", "Lahore"]);
    const enrollment = await db().enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: user.id, courseId } } });
    expect([enrollment.status, enrollment.stage, enrollment.batchId]).toEqual(["APPROVED", "ENROLLMENT_CONFIRMED", batchA]);
    const after = await db().enrollmentApplication.findUniqueOrThrow({ where: { id: app.id }, include: { events: true } });
    expect([after.stage, after.userId, after.enrollmentId, after.openKey]).toEqual(["ENROLLMENT_CONFIRMED", user.id, enrollment.id, null]);
    expect(after.events.map((e) => e.stage)).toEqual(expect.arrayContaining(["APPLICATION_RECEIVED", "PAYMENT_PENDING", "PAYMENT_SUBMITTED", "PAYMENT_VERIFIED", "ENROLLMENT_CONFIRMED"]));
    const payment = await db().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect([payment.status, payment.userId, payment.amountReceived, payment.decidedById]).toEqual(["CONFIRMED", user.id, 1_500_000, sa.id]);
    // A "set your password" link was issued for the new account.
    expect(await db().verification.count({ where: { identifier: { startsWith: "reset-password:" }, value: user.id } })).toBe(1);
    // Applying again for the same program is refused once enrolled.
    await expect(apply(app.email, batchB)).rejects.toThrow("alreadyEnrolled");
  });

  it("never overbooks, blocks reused transaction IDs, and moves applications between batches", async () => {
    const { token, app } = bilal;
    // The batch is full now, so new applications for it are refused.
    await expect(apply(`late.${tag}@example.com`)).rejects.toThrow("batchUnavailable");
    await adm.confirmApplicationEmail(token);
    // The same transaction can't be claimed twice, however it's typed.
    await expect(pay(token, `tx ${tag}-1`.toUpperCase().replace(" ", "-"))).rejects.toThrow("referenceUsed");
    await pay(token, `TX-${tag}-3`);
    const paymentId = await pendingPayment(app.id);
    await expect(adm.verifyPayment(paymentId, { amountReceivedPkr: 15000 }, sa)).rejects.toThrow(/is full/);
    // The failed verification left nothing behind.
    expect((await db().payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PENDING");
    expect(await db().user.count({ where: { email: app.email } })).toBe(0);

    await expect(adm.moveApplication(app.id, batchB, cm)).rejects.toThrow(/Only Super Admins/);
    await adm.moveApplication(app.id, batchB, sa);
    await adm.verifyPayment(paymentId, { amountReceivedPkr: 15000 }, sa);
    expect((await db().enrollment.findFirstOrThrow({ where: { user: { email: app.email } } })).batchId).toBe(batchB);
  });

  it("rejecting a payment lets the applicant send it again; closing frees the slot", async () => {
    const { token, app } = await applyWithToken(`old.${tag}@example.com`, batchB);
    await adm.confirmApplicationEmail(token);
    await pay(token, `TX-${tag}-4`);
    const first = await pendingPayment(app.id);
    await expect(adm.closeApplication(app.id, "CANCELLED", "", sa)).rejects.toThrow(/payment is waiting/);
    await adm.rejectPayment(first, "We couldn't find this transaction", sa);
    const view = await db().enrollmentApplication.findUniqueOrThrow({ where: { id: app.id }, include: { events: { orderBy: { createdAt: "desc" }, take: 1 } } });
    expect([view.stage, view.events[0]?.note]).toEqual(["PAYMENT_PENDING", "We couldn't find this transaction"]);
    // A rejection replaced the emailed link, so the old token no longer works.
    expect(await adm.applicationByToken(token)).toBeNull();
    const fresh = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 11);
    await db().enrollmentApplication.update({ where: { id: app.id }, data: { tokenHash: hashToken(fresh) } });
    await pay(fresh, `TX-${tag}-5`);

    // Verifying a suspended old account reactivates it instead of creating a duplicate.
    await adm.verifyPayment(await pendingPayment(app.id), { amountReceivedPkr: 20000 }, sa);
    const old = await db().user.findUniqueOrThrow({ where: { id: id("old") } });
    expect([old.status, old.suspendedAt]).toEqual(["ACTIVE", null]);
    expect(await db().user.count({ where: { email: `old.${tag}@example.com` } })).toBe(1);

    const { app: other } = await applyWithToken(`zara.${tag}@example.com`, batchB);
    await adm.closeApplication(other.id, "CANCELLED", "Duplicate", sa);
    expect((await db().enrollmentApplication.findUniqueOrThrow({ where: { id: other.id } })).openKey).toBeNull();
    await apply(`zara.${tag}@example.com`, batchB);
  });

  it("keeps CNIC and CV to Super Admins", async () => {
    const app = await db().enrollmentApplication.findFirstOrThrow({ where: { email: `sara.${tag}@example.com` } });
    expect((await adm.getApplication(app.id, cm))?.cnic).toBeNull();
    expect((await adm.getApplication(app.id, sa))?.cnic).toBe("35202-1234567-1");
    expect(await adm.cvFor(app.id, cm)).toBeNull();
    expect((await adm.cvFor(app.id, sa))?.mimeType).toBe("application/pdf");
    expect(await adm.getApplication(app.id, { id: "x", role: "INSTRUCTOR" })).toBeNull();
  });
});
