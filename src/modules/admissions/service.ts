import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { Prisma, type EnrollmentStage } from "@/generated/prisma/client";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { pkDay } from "@/lib/pk-time";
import { deleteFile, putFile } from "@/lib/storage/local";
import { idsContaining } from "@/lib/text-search";
import { audit } from "@/modules/audit/log";
import { passwordSetupUrl } from "@/modules/auth/password-link";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { availability, SEAT_STAGES } from "@/modules/batches/rules";
import { actionEmail } from "@/modules/email/templates";
import { detectFile } from "@/modules/media/validate";
import { notify } from "@/modules/notifications/service";
import { availableMethods, coursePrice, formatPkr, getPaymentDetails, PAYMENT_METHODS, prepareReceipt } from "@/modules/payments/service";
import { CV_MAX_BYTES, CV_TYPES, formatCnic, hashToken, newReference, newToken, normaliseReference, OPEN_APPLICATION_STAGES, transactionKey } from "./rules";

/**
 * Admissions: a visitor applies for a batch, confirms their email through a
 * private link, pays the enrollment fee and sends the transaction details.
 * A Super Admin verifies the payment, which reserves the seat and creates
 * (or reactivates) the student account. Nothing is unlocked by a receipt alone.
 *
 * Errors thrown as AdmissionError carry a key of dict.apply.errors (public
 * forms) or a plain sentence (admin actions).
 */

export class AdmissionError extends Error {
  constructor(message: string, public readonly status = 400, public readonly field?: string) {
    super(message);
    this.name = "AdmissionError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;
const WELCOME_LINK_TTL = 7 * 24 * 60 * 60;
const dict = () => getDictionary("en");
const statusUrl = (token: string) => `${siteConfig.url}/api/applications/open?t=${token}`;

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

const trimmed = (max: number, key: string) => z.string().trim().min(1, key).max(max, key);

export const applicationInput = z.object({
  batchId: z.string().trim().min(1, "batchId").max(64, "batchId"),
  name: trimmed(120, "name").refine((v) => v.length >= 3 && !/[\x00-\x1f\x7f<>]/.test(v), "name"),
  email: z.email("email").max(254, "email").transform((v) => v.trim().toLowerCase()),
  phone: z.string().trim().regex(/^[+()\-\s\d]{7,40}$/, "phone"),
  city: trimmed(80, "city").refine((v) => v.length >= 2, "city"),
  cnic: z.string().transform((v, ctx) => {
    const f = formatCnic(v);
    if (!f) ctx.addIssue({ code: "custom", message: "cnic" });
    return f ?? "";
  }),
  message: z.string().trim().max(1000).optional().transform((v) => v || null),
  acceptTerms: z.literal(true, "acceptTerms"),
});
export type ApplicationInput = z.infer<typeof applicationInput>;

type Upload = { data: Buffer; name: string };

function prepareCv(cv: Upload) {
  if (cv.data.length > CV_MAX_BYTES) throw new AdmissionError("cvTooLarge", 413, "cv");
  const detected = detectFile(cv.data, cv.name);
  if (!detected || !(CV_TYPES as readonly string[]).includes(detected.mime)) throw new AdmissionError("cvType", 422, "cv");
  return detected;
}

function privateKey(folder: string, ext: string) {
  const now = new Date();
  return `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
}

/** Records an application and emails the private status link. Returns the reference. */
export async function submitApplication(input: ApplicationInput, cv: Upload) {
  const batch = await db().batch.findUnique({
    where: { id: input.batchId },
    include: { course: { select: { id: true, title: true, status: true, accessType: true, priceAmount: true } } },
  });
  const fee = batch && batch.course.status === "PUBLISHED" ? coursePrice(batch.course) : null;
  if (!batch || !fee) throw new AdmissionError("batchUnavailable", 404, "batchId");
  const taken = await db().enrollment.count({ where: { batchId: batch.id, stage: { in: [...SEAT_STAGES] } } });
  if (availability(batch, taken, pkDay()) !== "open") throw new AdmissionError("batchUnavailable", 409, "batchId");

  const existingUser = await db().user.findUnique({ where: { email: input.email }, select: { id: true, role: true } });
  if (existingUser && existingUser.role !== "STUDENT") throw new AdmissionError("staffEmail", 409, "email");
  if (existingUser) {
    const enrolled = await db().enrollment.findFirst({ where: { userId: existingUser.id, courseId: batch.courseId, stage: { in: [...SEAT_STAGES] } } });
    if (enrolled) throw new AdmissionError("alreadyEnrolled", 409, "email");
  }
  const openKey = `${input.email}|${batch.id}`;
  if (await db().enrollmentApplication.findUnique({ where: { openKey }, select: { id: true } })) throw new AdmissionError("alreadyApplied", 409, "email");

  const file = prepareCv(cv);
  const cvKey = privateKey("applications/cv", file.ext);
  await putFile(cvKey, cv.data);

  const token = newToken();
  let application;
  try {
    application = await db().enrollmentApplication.create({
      data: {
        reference: newReference(),
        courseId: batch.courseId,
        batchId: batch.id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        city: input.city,
        cnic: input.cnic,
        cvKey,
        cvMime: file.mime,
        cvSize: cv.data.length,
        cvName: `cv.${file.ext}`,
        message: input.message,
        feeAmount: fee,
        tokenHash: hashToken(token),
        termsAcceptedAt: new Date(),
        openKey,
        events: { create: { stage: "APPLICATION_RECEIVED" } },
      },
    });
  } catch (e) {
    await deleteFile(cvKey).catch(() => {});
    // Two submissions at once: the unique open key lets only one through.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AdmissionError("alreadyApplied", 409, "email");
    throw e;
  }
  await audit({ actorId: null, action: "application.received", entityType: "Application", entityId: application.id, metadata: { reference: application.reference, batch: batch.code } });

  const t = dict().apply;
  await sendBestEffort("confirm", {
    to: application.email,
    name: application.name,
    subject: format(t.emailConfirmSubject, { program: batch.course.title }),
    intro: format(t.emailConfirmIntro, { program: batch.course.title, batch: batch.name, reference: application.reference, amount: formatPkr(fee) }),
    buttonLabel: t.emailButton,
    url: statusUrl(token),
  });
  return { reference: application.reference, email: application.email };
}

// ---------------------------------------------------------------------------
// The applicant's private status page
// ---------------------------------------------------------------------------

const applicantView = {
  id: true,
  reference: true,
  name: true,
  email: true,
  stage: true,
  feeAmount: true,
  currency: true,
  decisionNote: true,
  emailConfirmedAt: true,
  createdAt: true,
  course: { select: { title: true, slug: true } },
  batch: { select: { name: true, code: true, startDate: true, endDate: true, scheduleText: true } },
  events: { orderBy: { createdAt: "asc" }, select: { stage: true, note: true, createdAt: true } },
  payments: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, method: true, reference: true, amount: true, decisionNote: true, createdAt: true } },
} satisfies Prisma.EnrollmentApplicationSelect;

export type ApplicantView = Prisma.EnrollmentApplicationGetPayload<{ select: typeof applicantView }>;

/** The application a status-link token belongs to (null if unknown or replaced). */
export function applicationByToken(token: string) {
  return db().enrollmentApplication.findUnique({ where: { tokenHash: hashToken(token) }, select: applicantView });
}

/** Opening the emailed link proves the applicant owns the inbox: move on to payment. */
export async function confirmApplicationEmail(token: string) {
  const app = await db().enrollmentApplication.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, stage: true, emailConfirmedAt: true } });
  if (!app) return false;
  if (!app.emailConfirmedAt) {
    const moved = await db().enrollmentApplication.updateMany({
      where: { id: app.id, stage: "APPLICATION_RECEIVED" },
      data: { emailConfirmedAt: new Date(), stage: "PAYMENT_PENDING" },
    });
    if (moved.count) await db().enrollmentEvent.create({ data: { applicationId: app.id, stage: "PAYMENT_PENDING" } });
    else await db().enrollmentApplication.update({ where: { id: app.id }, data: { emailConfirmedAt: new Date() } });
  }
  return true;
}

/**
 * "Email me a new link": a fresh token replaces the old one (earlier links and
 * cookies stop working). Says nothing about whether the application exists.
 */
export async function resendApplicationLink(email: string, reference: string) {
  const app = await db().enrollmentApplication.findFirst({
    where: { email: email.trim().toLowerCase(), reference: normaliseReference(reference) },
    include: { course: { select: { title: true } } },
  });
  if (!app) return;
  const token = newToken();
  await db().enrollmentApplication.update({ where: { id: app.id }, data: { tokenHash: hashToken(token) } });
  const t = dict().apply;
  await sendBestEffort("new link", {
    to: app.email,
    name: app.name,
    subject: t.emailLinkSubject,
    intro: format(t.emailLinkIntro, { reference: app.reference, program: app.course.title }),
    buttonLabel: t.emailButton,
    url: statusUrl(token),
  });
}

export const paymentInput = z.object({
  method: z.enum(PAYMENT_METHODS, "method"),
  reference: z.string().trim().min(3, "reference").max(100, "reference"),
  payerName: z.string().trim().max(120).optional().transform((v) => v || null),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paidOn")
    .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now() + 36 * 3600_000, "paidOn"),
  note: z.string().trim().max(1000).optional().transform((v) => v || null),
});

/** The applicant sends the transaction ID and receipt. Errors are keys of dict.payments.errors. */
export async function submitApplicationPayment(token: string, input: z.infer<typeof paymentInput>, receipt: Upload) {
  const app = await db().enrollmentApplication.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { course: { select: { title: true } }, batch: { select: { name: true } } },
  });
  if (!app) throw new PaymentNotAllowed("notAvailable", 404);
  if (app.stage === "PAYMENT_SUBMITTED") throw new PaymentNotAllowed("alreadySubmitted", 409);
  if (app.stage !== "PAYMENT_PENDING") throw new PaymentNotAllowed("notAvailable", 409);
  if (!availableMethods(await getPaymentDetails()).includes(input.method)) throw new PaymentNotAllowed("methodUnavailable", 422);
  // The same transaction can't be used for two applications (or twice for one).
  const key = transactionKey(input.method, input.reference);
  const sameTransaction = await db().payment.findFirst({
    where: { method: input.method, status: { in: ["PENDING", "CONFIRMED"] }, OR: [{ verifiedKey: key }, { reference: { in: referenceVariants(input.reference) } }] },
    select: { id: true },
  });
  if (sameTransaction) throw new PaymentNotAllowed("referenceUsed", 409);

  const file = await prepareReceipt(receipt);
  const receiptKey = privateKey("receipts", file.ext);
  await putFile(receiptKey, file.data);

  let paymentId: string;
  try {
    paymentId = await db().$transaction(async (tx) => {
      const moved = await tx.enrollmentApplication.updateMany({ where: { id: app.id, stage: "PAYMENT_PENDING" }, data: { stage: "PAYMENT_SUBMITTED" } });
      if (!moved.count) throw new PaymentNotAllowed("alreadySubmitted", 409);
      const payment = await tx.payment.create({
        data: {
          applicationId: app.id,
          courseId: app.courseId,
          amount: app.feeAmount,
          currency: app.currency,
          method: input.method,
          reference: input.reference,
          payerName: input.payerName,
          paidOn: new Date(`${input.paidOn}T00:00:00Z`),
          note: input.note,
          receiptKey,
          receiptMime: file.mime,
          receiptSize: file.data.length,
          receiptName: `receipt.${file.ext}`,
        },
      });
      await tx.enrollmentEvent.create({ data: { applicationId: app.id, stage: "PAYMENT_SUBMITTED" } });
      return payment.id;
    });
  } catch (e) {
    await deleteFile(receiptKey).catch(() => {});
    throw e;
  }
  await audit({ actorId: null, action: "payment.submitted", entityType: "Payment", entityId: paymentId, metadata: { reference: app.reference, amount: app.feeAmount, method: input.method } });

  const p = getDictionary("en").payments;
  await sendBestEffort("payment received", {
    to: app.email,
    name: app.name,
    subject: format(p.emailReceivedSubject, { course: app.course.title }),
    intro: format(p.emailReceivedIntro, { course: app.course.title, amount: formatPkr(app.feeAmount), reference: input.reference }),
    buttonLabel: dict().apply.emailButton,
    url: `${siteConfig.url}/application`,
  });
  await alertSuperAdmins(app.id, { name: app.name, program: app.course.title, batch: app.batch.name, amount: formatPkr(app.feeAmount) });
}

/** Applicant-side payment errors (keys of dict.payments.errors). */
export class PaymentNotAllowed extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "PaymentNotAllowed";
  }
}

/** The reference as typed, plus spacing/dash/case variants, to catch the same transaction typed differently. */
function referenceVariants(reference: string) {
  const r = reference.trim();
  const compact = r.replace(/[\s-]/g, "");
  return [...new Set([r, r.toUpperCase(), r.toLowerCase(), compact, compact.toUpperCase(), compact.toLowerCase()])];
}

// ---------------------------------------------------------------------------
// Admin: list and detail
// ---------------------------------------------------------------------------

export const APPLICATION_TABS = ["PAYMENT_SUBMITTED", "PAYMENT_PENDING", "APPLICATION_RECEIVED", "ENROLLMENT_CONFIRMED", "CLOSED", "ALL"] as const;
export type ApplicationTab = (typeof APPLICATION_TABS)[number];

export type ApplicationFilter = { tab: ApplicationTab; batchId?: string; q?: string };

export function parseApplicationFilter(sp: Record<string, string | string[] | undefined>): ApplicationFilter {
  const one = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    tab: APPLICATION_TABS.find((t) => t === sp.tab) ?? "PAYMENT_SUBMITTED",
    batchId: one(sp.batch).slice(0, 64) || undefined,
    q: one(sp.q).slice(0, 100) || undefined,
  };
}

function tabWhere(tab: ApplicationTab): Prisma.EnrollmentApplicationWhereInput {
  if (tab === "ALL") return {};
  if (tab === "CLOSED") return { stage: { in: ["REJECTED", "CANCELLED", "WITHDRAWN"] } };
  if (tab === "ENROLLMENT_CONFIRMED") return { enrollmentId: { not: null } };
  return { stage: tab };
}

export async function listApplications(f: ApplicationFilter, actor: Actor) {
  if (!can(actor.role, "applications.view")) throw new AdmissionError("You don't have permission to see applications.", 403);
  const base: Prisma.EnrollmentApplicationWhereInput = {
    ...(f.batchId ? { batchId: f.batchId } : {}),
    ...(f.q
      ? { OR: [{ reference: normaliseReference(f.q) }, { id: { in: await idsContaining("EnrollmentApplication", ["name", "email", "phone"], f.q) } }] }
      : {}),
  };
  const [items, counts] = await Promise.all([
    db().enrollmentApplication.findMany({
      where: { ...base, ...tabWhere(f.tab) },
      orderBy: f.tab === "PAYMENT_SUBMITTED" ? { updatedAt: "asc" } : { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        reference: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        stage: true,
        feeAmount: true,
        createdAt: true,
        updatedAt: true,
        enrollmentId: true,
        course: { select: { title: true } },
        batch: { select: { name: true, code: true } },
      },
    }),
    db().enrollmentApplication.groupBy({ by: ["stage"], where: base, _count: { _all: true } }),
  ]);
  const byStage = Object.fromEntries(counts.map((c) => [c.stage, c._count._all])) as Partial<Record<EnrollmentStage, number>>;
  return { items, byStage };
}

export function waitingPaymentCount() {
  return db().enrollmentApplication.count({ where: { stage: "PAYMENT_SUBMITTED" } });
}

export async function getApplication(id: string, actor: Actor) {
  if (!can(actor.role, "applications.view")) return null;
  const app = await db().enrollmentApplication.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, title: true, slug: true } },
      batch: { select: { id: true, name: true, code: true, startDate: true, capacity: true, status: true } },
      user: { select: { id: true, name: true, status: true } },
      decidedBy: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" }, include: { decidedBy: { select: { name: true } } } },
    },
  });
  if (!app) return null;
  // CNIC and CV are for Super Admins only.
  if (!can(actor.role, "applications.sensitive")) return { ...app, cnic: null, cvKey: null, cvName: null };
  return app;
}

/** CV file of an application, for Super Admins only. */
export async function cvFor(applicationId: string, viewer: Actor) {
  if (!can(viewer.role, "applications.sensitive")) return null;
  const a = await db().enrollmentApplication.findUnique({ where: { id: applicationId }, select: { cvKey: true, cvMime: true, cvSize: true, cvName: true, reference: true } });
  if (!a?.cvKey || !a.cvMime) return null;
  return { storageKey: a.cvKey, mimeType: a.cvMime, sizeBytes: a.cvSize ?? 0, originalName: `${a.reference}-${a.cvName ?? "cv"}` };
}

// ---------------------------------------------------------------------------
// Admin: verify or reject a payment
// ---------------------------------------------------------------------------

function assertSuperAdmin(actor: Actor, what: string) {
  if (!can(actor.role, "payments.manage")) throw new AdmissionError(`Only Super Admins can ${what}.`, 403);
}

export const verifyInput = z.object({
  /** Whole rupees the Super Admin saw arrive. */
  amountReceivedPkr: z.preprocess((v) => String(v ?? "").replace(/[,\s]/g, ""), z.coerce.number().int("Use whole rupees").min(1, "Enter the amount received").max(10_000_000)),
});

/**
 * Money received: verify the payment, reserve the seat and create (or
 * reactivate) the student account, all in one transaction. Then email the
 * student a link to set their password.
 */
export async function verifyPayment(paymentId: string, input: z.infer<typeof verifyInput>, actor: Actor) {
  assertSuperAdmin(actor, "verify payments");
  const payment = await db().payment.findUnique({
    where: { id: paymentId },
    include: { application: { include: { course: { select: { title: true } }, batch: { select: { id: true, name: true, code: true, capacity: true } } } } },
  });
  const app = payment?.application;
  if (!payment || !app) throw new AdmissionError("Payment not found.", 404);
  if (payment.status !== "PENDING") throw new AdmissionError("This payment was already handled. Refresh the page to see its status.", 409);
  const received = input.amountReceivedPkr * 100;
  if (received < payment.amount) {
    throw new AdmissionError(`The fee is ${formatPkr(payment.amount)} and must be paid in full. Reject the payment with a note if less arrived.`);
  }

  let result: { userId: string; enrollmentId: string; newAccount: boolean; hasPassword: boolean };
  try {
    result = await db().$transaction(async (tx) => {
      const now = new Date();
      const marked = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "CONFIRMED", decidedAt: now, decidedById: actor.id, decisionNote: null, amountReceived: received, verifiedKey: transactionKey(payment.method, payment.reference) },
      });
      if (!marked.count) throw new AdmissionError("This payment was already handled. Refresh the page to see its status.", 409);

      // Lock the batch row so two verifications can't both take the last seat.
      await tx.$queryRaw`SELECT id FROM Batch WHERE id = ${app.batchId} FOR UPDATE`;
      const taken = await tx.enrollment.count({ where: { batchId: app.batchId, stage: { in: [...SEAT_STAGES] } } });
      if (taken >= app.batch.capacity) {
        throw new AdmissionError(`${app.batch.name} is full (${taken} of ${app.batch.capacity} seats). Move this application to another batch or add seats first.`, 409);
      }

      let user = await tx.user.findUnique({ where: { email: app.email }, include: { accounts: { select: { id: true } } } });
      if (user && user.role !== "STUDENT") throw new AdmissionError("This email belongs to a team account. Ask the applicant for a personal email.", 409);
      const newAccount = !user;
      if (!user) {
        user = await tx.user.create({
          data: { id: randomUUID().replace(/-/g, ""), name: app.name, email: app.email, emailVerified: true, role: "STUDENT", phone: app.phone, city: app.city },
          include: { accounts: { select: { id: true } } },
        });
      } else {
        // An earlier account (e.g. suspended free sign-up) is reactivated and brought up to date.
        user = await tx.user.update({
          where: { id: user.id },
          data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null, emailVerified: true, phone: app.phone, city: app.city },
          include: { accounts: { select: { id: true } } },
        });
      }

      const existing = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: app.courseId } } });
      if (existing?.stage && (SEAT_STAGES as readonly string[]).includes(existing.stage)) {
        throw new AdmissionError("This student is already enrolled in this program.", 409);
      }
      const enrollmentData = { status: "APPROVED" as const, batchId: app.batchId, stage: "ENROLLMENT_CONFIRMED" as const, stageAt: now, decidedAt: now, decidedById: actor.id, decisionNote: null, completedAt: null };
      const enrollment = existing
        ? await tx.enrollment.update({ where: { id: existing.id }, data: enrollmentData })
        : await tx.enrollment.create({ data: { userId: user.id, courseId: app.courseId, requestedAt: app.createdAt, ...enrollmentData } });

      const moved = await tx.enrollmentApplication.updateMany({
        where: { id: app.id, stage: "PAYMENT_SUBMITTED" },
        data: { stage: "ENROLLMENT_CONFIRMED", userId: user.id, enrollmentId: enrollment.id, openKey: null, decidedAt: now, decidedById: actor.id, decisionNote: null },
      });
      if (!moved.count) throw new AdmissionError("This application changed meanwhile. Refresh the page.", 409);
      await tx.payment.update({ where: { id: payment.id }, data: { userId: user.id } });
      await tx.enrollmentEvent.createMany({
        data: [
          { applicationId: app.id, stage: "PAYMENT_VERIFIED", actorId: actor.id, createdAt: now },
          { applicationId: app.id, enrollmentId: enrollment.id, stage: "ENROLLMENT_CONFIRMED", actorId: actor.id, createdAt: new Date(now.getTime() + 1) },
        ],
      });
      return { userId: user.id, enrollmentId: enrollment.id, newAccount, hasPassword: user.accounts.length > 0 };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AdmissionError("This transaction ID was already verified for another payment. Check the statement before verifying.", 409);
    }
    throw e;
  }

  await audit({
    actorId: actor.id,
    action: "payment.verified",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { reference: app.reference, amount: payment.amount, received, batch: app.batch.code, account: result.newAccount ? "created" : "existing" },
  });
  const t = dict().apply;
  const values = { program: app.course.title, batch: app.batch.name };
  await notify(result.userId, { type: "ENROLLMENT_UPDATE", title: format(t.emailWelcomeSubject, values), body: null, link: "/account" }).catch(() => {});
  const url = result.hasPassword ? `${siteConfig.url}/login?next=/account` : await passwordSetupUrl(result.userId, WELCOME_LINK_TTL);
  await sendBestEffort("welcome", {
    to: app.email,
    name: app.name,
    subject: format(t.emailWelcomeSubject, values),
    intro: format(result.hasPassword ? t.emailWelcomeBackIntro : t.emailWelcomeIntro, values),
    buttonLabel: result.hasPassword ? t.emailWelcomeBackButton : t.emailWelcomeButton,
    url,
  });
  return result;
}

/** Money not received or details wrong: the applicant is told why and can send them again. */
export async function rejectPayment(paymentId: string, note: string, actor: Actor) {
  assertSuperAdmin(actor, "reject payments");
  const reason = note.trim().slice(0, 1000);
  if (reason.length < 3) throw new AdmissionError("Tell the applicant why, so they can fix it.");
  const payment = await db().payment.findUnique({ where: { id: paymentId }, include: { application: { include: { course: { select: { title: true } } } } } });
  const app = payment?.application;
  if (!payment || !app) throw new AdmissionError("Payment not found.", 404);
  await db().$transaction(async (tx) => {
    const marked = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "REJECTED", decidedAt: new Date(), decidedById: actor.id, decisionNote: reason } });
    if (!marked.count) throw new AdmissionError("This payment was already handled. Refresh the page to see its status.", 409);
    await tx.enrollmentApplication.updateMany({ where: { id: app.id, stage: "PAYMENT_SUBMITTED" }, data: { stage: "PAYMENT_PENDING" } });
    await tx.enrollmentEvent.create({ data: { applicationId: app.id, stage: "PAYMENT_PENDING", note: reason, actorId: actor.id } });
  });
  await audit({ actorId: actor.id, action: "payment.rejected", entityType: "Payment", entityId: payment.id, metadata: { reference: app.reference } });
  const t = dict().apply;
  await emailWithFreshLink(app.id, {
    subject: format(t.emailPaymentRejectedSubject, { reference: app.reference }),
    intro: format(t.emailPaymentRejectedIntro, { program: app.course.title, note: reason }),
  });
}

// ---------------------------------------------------------------------------
// Admin: move, reject or cancel an open application
// ---------------------------------------------------------------------------

async function openApplication(id: string) {
  const app = await db().enrollmentApplication.findUnique({ where: { id }, include: { course: { select: { title: true } }, batch: { select: { code: true } } } });
  if (!app) throw new AdmissionError("Application not found.", 404);
  if (!(OPEN_APPLICATION_STAGES as readonly string[]).includes(app.stage)) throw new AdmissionError("Only open applications can be changed.", 409);
  return app;
}

/** Move an open application to another batch of the same program (e.g. its batch filled up). */
export async function moveApplication(id: string, batchId: string, actor: Actor) {
  if (!can(actor.role, "enrollments.admin")) throw new AdmissionError("Only Super Admins can move applications.", 403);
  const app = await openApplication(id);
  const target = await db().batch.findUnique({ where: { id: batchId }, select: { id: true, courseId: true, code: true, name: true, status: true } });
  if (!target || target.courseId !== app.courseId) throw new AdmissionError("Choose a batch of the same program.");
  if (target.id === app.batchId) return;
  if (["COMPLETED", "CANCELLED"].includes(target.status)) throw new AdmissionError("That batch is completed or cancelled.");
  try {
    await db().enrollmentApplication.update({ where: { id }, data: { batchId: target.id, openKey: `${app.email}|${target.id}` } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AdmissionError("This applicant already has an open application for that batch.", 409);
    throw e;
  }
  await audit({ actorId: actor.id, action: "application.moved", entityType: "Application", entityId: id, metadata: { reference: app.reference, from: app.batch.code, to: target.code } });
}

export async function closeApplication(id: string, outcome: "REJECTED" | "CANCELLED", note: string, actor: Actor) {
  if (!can(actor.role, "enrollments.admin")) throw new AdmissionError("Only Super Admins can reject or cancel applications.", 403);
  const app = await openApplication(id);
  if (await db().payment.count({ where: { applicationId: id, status: "PENDING" } })) {
    throw new AdmissionError("A payment is waiting. Verify or reject it first.", 409);
  }
  const reason = note.trim().slice(0, 1000) || null;
  await db().$transaction(async (tx) => {
    const moved = await tx.enrollmentApplication.updateMany({
      where: { id, stage: { in: [...OPEN_APPLICATION_STAGES] } },
      data: { stage: outcome, openKey: null, decidedAt: new Date(), decidedById: actor.id, decisionNote: reason },
    });
    if (!moved.count) throw new AdmissionError("This application changed meanwhile. Refresh the page.", 409);
    await tx.enrollmentEvent.create({ data: { applicationId: id, stage: outcome, note: reason, actorId: actor.id } });
  });
  await audit({ actorId: actor.id, action: outcome === "REJECTED" ? "application.rejected" : "application.cancelled", entityType: "Application", entityId: id, metadata: { reference: app.reference } });
  const t = dict().apply;
  await emailWithFreshLink(id, {
    subject: format(t.emailClosedSubject, { reference: app.reference }),
    intro: [format(outcome === "REJECTED" ? t.emailRejectedIntro : t.emailCancelledIntro, { program: app.course.title }), reason ? format(t.noteFromTeam, { note: reason }) : ""].filter(Boolean).join(" "),
  });
}

/** Staff resend the applicant's status link (a fresh one). */
export async function resendLinkAsStaff(id: string, actor: Actor) {
  if (!can(actor.role, "applications.view")) throw new AdmissionError("You don't have permission to do that.", 403);
  const app = await db().enrollmentApplication.findUnique({ where: { id }, select: { email: true, reference: true } });
  if (!app) throw new AdmissionError("Application not found.", 404);
  await resendApplicationLink(app.email, app.reference);
  await audit({ actorId: actor.id, action: "application.link_sent", entityType: "Application", entityId: id, metadata: { reference: app.reference } });
}

// ---------------------------------------------------------------------------
// Emails (best effort: the change is saved either way)
// ---------------------------------------------------------------------------

async function sendBestEffort(what: string, mail: { to: string; name: string; subject: string; intro: string; buttonLabel: string; url: string }) {
  try {
    await sendMail(actionEmail({ dict: dict(), locale: "en", ignoreNote: false, ...mail }));
  } catch (err) {
    console.warn(`[admissions] ${what} email not sent:`, err instanceof Error ? err.message : err);
  }
}

/** Emails the applicant with a fresh status link (the stored token is only a hash, so a new one is issued). */
async function emailWithFreshLink(applicationId: string, content: { subject: string; intro: string }) {
  const token = newToken();
  const app = await db().enrollmentApplication.update({ where: { id: applicationId }, data: { tokenHash: hashToken(token) }, select: { email: true, name: true } });
  await sendBestEffort("status", { to: app.email, name: app.name, ...content, buttonLabel: dict().apply.emailButton, url: statusUrl(token) });
}

async function alertSuperAdmins(applicationId: string, values: { name: string; program: string; batch: string; amount: string }) {
  const admins = await db().user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { email: true } });
  const t = dict().apply;
  for (const a of admins) {
    await sendBestEffort("admin alert", {
      to: a.email,
      name: "Digitals Minds team",
      subject: format(t.emailAlertSubject, values),
      intro: format(t.emailAlertIntro, values),
      buttonLabel: t.emailAlertButton,
      url: `${siteConfig.url}/admin/applications/${applicationId}`,
    });
  }
}

