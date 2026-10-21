import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import type { PaymentMethod, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { deleteFile, putFile } from "@/lib/storage/local";
import { idsContaining } from "@/lib/text-search";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { saveSetting } from "@/modules/content/settings";
import { actionEmail } from "@/modules/email/templates";
import { decideEnrollment, enrollmentFor } from "@/modules/learning/enrollment";
import { processImage } from "@/modules/media/images";
import { detectFile } from "@/modules/media/validate";

/**
 * Paid courses with manual payments: the student pays by bank transfer,
 * JazzCash or EasyPaisa, then submits the transaction ID and a receipt. A
 * Super Admin checks the money arrived and confirms, which opens the course.
 * Amounts are stored in paisa (PKR minor units).
 */

export class PaymentError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "PaymentError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

export const PAYMENT_METHODS = ["BANK_TRANSFER", "JAZZCASH", "EASYPAISA"] as const satisfies readonly PaymentMethod[];
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

/** "Rs 15,000" (whole rupees; paisa shown only when present). */
export function formatPkr(paisa: number) {
  const rupees = paisa / 100;
  return `Rs ${rupees.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Payment account details (Admin → Payments → Payment details, Super Admin)
// ---------------------------------------------------------------------------

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const paymentDetailsInput = z.object({
  bankName: opt(120),
  bankAccountTitle: opt(120),
  bankAccountNumber: opt(60),
  jazzcashTitle: opt(120),
  jazzcashNumber: opt(40),
  easypaisaTitle: opt(120),
  easypaisaNumber: opt(40),
  instructions: opt(1500),
  instructionsUr: opt(1500),
});
export type PaymentDetails = Partial<z.infer<typeof paymentDetailsInput>>;

export async function getPaymentDetails(): Promise<PaymentDetails> {
  try {
    const row = await db().siteSetting.findUnique({ where: { key: "site.payments" } });
    const parsed = paymentDetailsInput.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export async function savePaymentDetails(value: PaymentDetails, actor: Actor) {
  if (!can(actor.role, "payments.manage")) throw new PaymentError("Only Super Admins can change payment details.", 403);
  await saveSetting("site.payments", value, actor.id);
  // Account numbers are not repeated in the log.
  await audit({ actorId: actor.id, action: "payments.details", entityType: "Setting", entityId: "site.payments", metadata: { methods: availableMethods(value) } });
}

/** Methods the owner has filled in (only these are offered to students). */
export function availableMethods(d: PaymentDetails): PaymentMethod[] {
  return [
    ...(d.bankAccountNumber ? (["BANK_TRANSFER"] as const) : []),
    ...(d.jazzcashNumber ? (["JAZZCASH"] as const) : []),
    ...(d.easypaisaNumber ? (["EASYPAISA"] as const) : []),
  ];
}

// ---------------------------------------------------------------------------
// Course price (Super Admin)
// ---------------------------------------------------------------------------

export const priceInput = z.object({
  paid: z.boolean(),
  /** Whole rupees. */
  pricePkr: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : String(v).replace(/[,\s]/g, "")),
    z.coerce.number().int("Use whole rupees").min(100, "At least Rs 100").max(10_000_000, "That looks too high").optional(),
  ),
});

export async function setCoursePrice(courseId: string, input: z.infer<typeof priceInput>, actor: Actor) {
  if (!can(actor.role, "payments.manage")) throw new PaymentError("Only Super Admins can set course prices.", 403);
  if (input.paid && !input.pricePkr) throw new z.ZodError([{ code: "custom", path: ["pricePkr"], message: "Enter the fee in rupees", input: input.pricePkr }]);
  const course = await db().course.update({
    where: { id: courseId },
    data: input.paid ? { accessType: "PAID", priceAmount: input.pricePkr! * 100, currency: "PKR" } : { accessType: "FREE", priceAmount: null, currency: null },
  });
  await audit({ actorId: actor.id, action: "course.price", entityType: "Course", entityId: courseId, metadata: { title: course.title, paid: input.paid, pricePkr: input.paid ? input.pricePkr : null } });
}

/** Whether a course charges a fee (and how much, in paisa). */
export function coursePrice(course: { accessType: string; priceAmount: number | null }): number | null {
  return course.accessType === "PAID" && course.priceAmount && course.priceAmount > 0 ? course.priceAmount : null;
}

/** "Rs 15,000" for paid courses, otherwise the given "Free" label. */
export function priceLabel(course: { accessType: string; priceAmount: number | null }, freeLabel: string) {
  const price = coursePrice(course);
  return price ? formatPkr(price) : freeLabel;
}

// ---------------------------------------------------------------------------
// Student: submit a payment
// ---------------------------------------------------------------------------

export const submitInput = z.object({
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().min(3, "reference").max(100, "reference"),
  payerName: z.string().trim().max(120).optional().transform((v) => v || null),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paidOn")
    .refine((v) => new Date(`${v}T00:00:00Z`).getTime() <= Date.now() + 36 * 3600_000, "paidOn"),
  googleEmail: z.email("googleEmail").max(254).transform((v) => v.trim().toLowerCase()),
  note: z.string().trim().max(1000).optional().transform((v) => v || null),
});

type Receipt = { data: Buffer; name: string };

/** Validates a receipt by its content and returns what to store (images are re-encoded, removing metadata). */
async function prepareReceipt(r: Receipt) {
  if (r.data.length > RECEIPT_MAX_BYTES) throw new PaymentError("receiptTooLarge", 413);
  const detected = detectFile(r.data, r.name);
  if (!detected || (detected.kind === "document" && detected.mime !== "application/pdf")) throw new PaymentError("receiptType", 422);
  if (detected.kind === "image") {
    try {
      const out = await processImage(r.data, detected.mime);
      return { data: out.data, mime: detected.mime, ext: detected.ext };
    } catch {
      throw new PaymentError("receiptType", 422);
    }
  }
  return { data: r.data, mime: detected.mime, ext: detected.ext };
}

/**
 * Records a payment and puts the student in the queue (enrollment REQUESTED).
 * Errors are message keys from dict.payments so the page can translate them.
 */
export async function submitPayment(user: Pick<CurrentUser, "id" | "name">, courseId: string, input: z.infer<typeof submitInput>, receipt: Receipt) {
  const course = await db().course.findUnique({ where: { id: courseId }, select: { id: true, status: true, title: true, accessType: true, priceAmount: true } });
  const price = course && course.status === "PUBLISHED" ? coursePrice(course) : null;
  if (!course || !price) throw new PaymentError("notAvailable", 404);
  if (!availableMethods(await getPaymentDetails()).includes(input.method)) throw new PaymentError("methodUnavailable", 422);
  const enrollment = await enrollmentFor(user.id, courseId);
  if (enrollment?.status === "APPROVED") throw new PaymentError("alreadyEnrolled", 409);
  if (await db().payment.findFirst({ where: { userId: user.id, courseId, status: "PENDING" } })) throw new PaymentError("alreadySubmitted", 409);

  const file = await prepareReceipt(receipt);
  const now = new Date();
  const key = `receipts/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${file.ext}`;
  await putFile(key, file.data);

  const reset = { status: "REQUESTED" as const, requestNote: input.note, requestedAt: now, decidedAt: null, decidedById: null, decisionNote: null };
  let payment;
  try {
    [payment] = await db().$transaction([
      db().payment.create({
        data: {
          userId: user.id,
          courseId,
          amount: price,
          currency: "PKR",
          method: input.method,
          reference: input.reference,
          payerName: input.payerName,
          paidOn: new Date(`${input.paidOn}T00:00:00Z`),
          note: input.note,
          receiptKey: key,
          receiptMime: file.mime,
          receiptSize: file.data.length,
          receiptName: `receipt.${file.ext}`,
        },
      }),
      enrollment
        ? db().enrollment.update({ where: { id: enrollment.id }, data: reset })
        : db().enrollment.create({ data: { userId: user.id, courseId, ...reset } }),
      db().user.update({ where: { id: user.id }, data: { googleEmail: input.googleEmail } }),
    ]);
  } catch (e) {
    await deleteFile(key).catch(() => {});
    throw e;
  }
  await audit({ actorId: user.id, action: "payment.submitted", entityType: "Payment", entityId: payment.id, metadata: { course: course.title, amount: price, method: input.method } });
  await Promise.all([sendSubmittedEmails(payment.id), notifyAdmins(payment.id)]);
  return payment;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type PaymentFilter = { status?: PaymentStatus; q?: string };

export function parsePaymentFilter(sp: Record<string, string | string[] | undefined>): PaymentFilter {
  const status = sp.status === "ALL" ? undefined : (["PENDING", "CONFIRMED", "REJECTED"] as const).find((s) => s === sp.status) ?? "PENDING";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) || undefined : undefined;
  return { status, q };
}

export async function listPayments(f: PaymentFilter) {
  const where: Prisma.PaymentWhereInput = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.q ? { userId: { in: await idsContaining("User", ["name", "email"], f.q) } } : {}),
  };
  return db().payment.findMany({
    where,
    orderBy: f.status === "PENDING" ? { createdAt: "asc" } : { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } }, course: { select: { title: true, slug: true } }, decidedBy: { select: { name: true } } },
  });
}

export function pendingPaymentCount() {
  return db().payment.count({ where: { status: "PENDING" } });
}

export function getPayment(id: string) {
  return db().payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, googleEmail: true } },
      course: { select: { id: true, title: true, slug: true, priceAmount: true, accessType: true } },
      decidedBy: { select: { name: true } },
    },
  });
}

async function pendingPayment(id: string) {
  const p = await db().payment.findUnique({ where: { id }, include: { course: { select: { title: true } } } });
  if (!p) throw new PaymentError("Payment not found.", 404);
  if (p.status !== "PENDING") throw new PaymentError("This payment was already handled. Refresh the page to see its status.", 409);
  return p;
}

/** Money received: mark confirmed and open the course (sends the usual "access approved" email). */
export async function confirmPayment(id: string, actor: Actor) {
  if (!can(actor.role, "payments.manage")) throw new PaymentError("Only Super Admins can confirm payments.", 403);
  const p = await pendingPayment(id);
  await db().payment.update({ where: { id }, data: { status: "CONFIRMED", decidedAt: new Date(), decidedById: actor.id, decisionNote: null } });
  await audit({ actorId: actor.id, action: "payment.confirmed", entityType: "Payment", entityId: id, metadata: { course: p.course.title, amount: p.amount } });
  const enrollment = await enrollmentFor(p.userId, p.courseId);
  if (enrollment && enrollment.status !== "APPROVED") await decideEnrollment(enrollment.id, "APPROVED", null, actor, { paymentConfirmed: true });
}

/** Money not received or details wrong: the student is told why and can submit again. */
export async function rejectPayment(id: string, note: string, actor: Actor) {
  if (!can(actor.role, "payments.manage")) throw new PaymentError("Only Super Admins can reject payments.", 403);
  const reason = note.trim().slice(0, 1000);
  if (reason.length < 3) throw new PaymentError("Tell the student why, so they can fix it.");
  const p = await pendingPayment(id);
  await db().payment.update({ where: { id }, data: { status: "REJECTED", decidedAt: new Date(), decidedById: actor.id, decisionNote: reason } });
  await audit({ actorId: actor.id, action: "payment.rejected", entityType: "Payment", entityId: id, metadata: { course: p.course.title } });
  const enrollment = await enrollmentFor(p.userId, p.courseId);
  if (enrollment?.status === "REQUESTED") {
    const dict = getDictionary("en");
    await decideEnrollment(enrollment.id, "REJECTED", format(dict.payments.rejectedReason, { note: reason }), actor, { paymentConfirmed: true });
  }
}

/** Receipt file for a payment, if the viewer may see it: Super Admins, Content Managers (view) and the student who paid. */
export async function receiptFor(paymentId: string, viewer: Actor) {
  const p = await db().payment.findUnique({ where: { id: paymentId } });
  if (!p?.receiptKey || !p.receiptMime) return null;
  if (p.userId !== viewer.id && !can(viewer.role, "payments.view")) return null;
  return { storageKey: p.receiptKey, mimeType: p.receiptMime, sizeBytes: p.receiptSize ?? 0, originalName: p.receiptName ?? "receipt" };
}

/** Latest payment per course for a student (dashboard status). */
export async function latestPaymentsFor(userId: string) {
  const rows = await db().payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { courseId: true, status: true, amount: true, decisionNote: true, createdAt: true } });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.courseId)) latest.set(r.courseId, r);
  return latest;
}

/** Receipt files of a user (removed when the account is deleted). */
export async function receiptKeysOf(userId: string) {
  return (await db().payment.findMany({ where: { userId, receiptKey: { not: null } }, select: { receiptKey: true } })).map((p) => p.receiptKey!);
}

// ---------------------------------------------------------------------------
// Emails and alerts (best effort)
// ---------------------------------------------------------------------------

async function sendSubmittedEmails(paymentId: string) {
  try {
    const p = await db().payment.findUniqueOrThrow({ where: { id: paymentId }, include: { user: true, course: true } });
    const locale: Locale = p.user.preferredLocale === "ur" ? "ur" : "en";
    const dict = getDictionary(locale);
    const course = locale === "ur" ? p.course.titleUr || p.course.title : p.course.title;
    await sendMail(
      actionEmail({
        dict,
        locale,
        to: p.user.email,
        name: p.user.name,
        subject: format(dict.payments.emailReceivedSubject, { course }),
        intro: format(dict.payments.emailReceivedIntro, { course, amount: formatPkr(p.amount), reference: p.reference }),
        buttonLabel: dict.payments.emailReceivedButton,
        url: `${siteConfig.url}${localizePath("/account", locale)}`,
        ignoreNote: false,
      }),
    );
  } catch (err) {
    console.warn("[payments] receipt email not sent:", err instanceof Error ? err.message : err);
  }
}

async function notifyAdmins(paymentId: string) {
  try {
    const p = await db().payment.findUniqueOrThrow({ where: { id: paymentId }, include: { user: true, course: true } });
    const admins = await db().user.findMany({ where: { role: "SUPER_ADMIN", status: "ACTIVE" }, select: { email: true } });
    const dict = getDictionary("en");
    const values = { name: p.user.name, course: p.course.title, amount: formatPkr(p.amount) };
    for (const a of admins) {
      await sendMail(
        actionEmail({
          dict,
          locale: "en",
          to: a.email,
          name: "Digitals Minds team",
          subject: format(dict.payments.emailAlertSubject, values),
          intro: format(dict.payments.emailAlertIntro, values),
          buttonLabel: dict.payments.emailAlertButton,
          url: `${siteConfig.url}/admin/payments/${p.id}`,
          ignoreNote: false,
        }),
      );
    }
  } catch (err) {
    console.warn("[payments] admin alert not sent:", err instanceof Error ? err.message : err);
  }
}
