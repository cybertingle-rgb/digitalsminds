import "server-only";
import { z } from "zod";
import type { PaymentMethod, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { idsContaining } from "@/lib/text-search";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { saveSetting } from "@/modules/content/settings";
import { decideEnrollment, enrollmentFor } from "@/modules/learning/enrollment";
import { processImage } from "@/modules/media/images";
import { mediaUrl } from "@/modules/media/service";
import { detectFile } from "@/modules/media/validate";

/**
 * Enrollment fees and manual payments (bank transfer, JazzCash, EasyPaisa):
 * fees, the account details applicants pay to, receipts and the payments list.
 * Applicants send their payment through their application (src/modules/admissions),
 * where a Super Admin verifies it. confirmPayment/rejectPayment below only handle
 * payments sent through the old per-course flow, before applications existed.
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

export { coursePrice, formatPkr } from "./format";
import { coursePrice, formatPkr } from "./format";

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
  /** Bank transfer QR code: empty = the built-in Meezan Bank QR, "none" = no QR, or a public image from Media. */
  bankQrId: opt(64),
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

export const NO_BANK_QR = "none";

/** Methods the owner has filled in (only these are offered to students). A bank QR code alone is enough for bank transfer. */
export function availableMethods(d: PaymentDetails): PaymentMethod[] {
  return [
    ...(d.bankAccountNumber || d.bankQrId !== NO_BANK_QR ? (["BANK_TRANSFER"] as const) : []),
    ...(d.jazzcashNumber ? (["JAZZCASH"] as const) : []),
    ...(d.easypaisaNumber ? (["EASYPAISA"] as const) : []),
  ];
}

/** The bank QR code to show: "builtin" (the bundled image), a Media image, or null for none. */
export async function bankQr(d: PaymentDetails): Promise<"builtin" | { src: string; width: number; height: number } | null> {
  if (d.bankQrId === NO_BANK_QR) return null;
  if (!d.bankQrId) return "builtin";
  const a = await db().mediaAsset.findUnique({ where: { id: d.bankQrId } }).catch(() => null);
  if (a?.visibility === "PUBLIC" && a.mimeType.startsWith("image/") && a.width && a.height) return { src: mediaUrl(a), width: a.width, height: a.height };
  // The chosen image was deleted from Media: fall back to the built-in QR rather than a bank method with nothing to pay to.
  return "builtin";
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

/** "Rs 15,000" for paid courses, otherwise the given "Free" label. */
export function priceLabel(course: { accessType: string; priceAmount: number | null }, freeLabel: string) {
  const price = coursePrice(course);
  return price ? formatPkr(price) : freeLabel;
}

// ---------------------------------------------------------------------------
// Student: submit a payment
// ---------------------------------------------------------------------------

type Receipt = { data: Buffer; name: string };

/** Validates a receipt by its content and returns what to store (images are re-encoded, removing metadata). */
export async function prepareReceipt(r: Receipt) {
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
    ...(f.q
      ? { OR: [{ userId: { in: await idsContaining("User", ["name", "email"], f.q) } }, { applicationId: { in: await idsContaining("EnrollmentApplication", ["name", "email", "reference"], f.q) } }] }
      : {}),
  };
  return db().payment.findMany({
    where,
    orderBy: f.status === "PENDING" ? { createdAt: "asc" } : { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      application: { select: { id: true, name: true, email: true, reference: true } },
      course: { select: { title: true, slug: true } },
      decidedBy: { select: { name: true } },
    },
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
  const enrollment = p.userId ? await enrollmentFor(p.userId, p.courseId) : null;
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
  const enrollment = p.userId ? await enrollmentFor(p.userId, p.courseId) : null;
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

