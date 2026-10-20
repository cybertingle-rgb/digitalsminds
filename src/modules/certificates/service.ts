import "server-only";
import { randomInt } from "node:crypto";
import { siteConfig } from "@/config/site";
import { localizePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { audit } from "@/modules/audit/log";
import { can } from "@/modules/auth/permissions";
import type { CurrentUser } from "@/modules/auth/session";
import { actionEmail } from "@/modules/email/templates";
import { notify } from "@/modules/notifications/service";

export class CertificateError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "CertificateError";
  }
}

type Actor = Pick<CurrentUser, "id" | "role">;

// No 0/O/1/I/L, so IDs read back correctly from paper.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newCertificateCode() {
  const pick = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `DM-${pick(4)}-${pick(4)}`;
}

/** Normalises what people type: case, spaces, missing dashes. */
export function normaliseCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("DM") ? raw.slice(2) : raw;
  if (!/^[2-9A-HJKMNP-Z]{8}$/.test(body)) return null;
  return `DM-${body.slice(0, 4)}-${body.slice(4)}`;
}

function assertCanIssue(actor: Actor) {
  if (!can(actor.role, "certificates.issue")) throw new CertificateError("You don't have permission to do that.", 403);
}

/**
 * Students who finished every lesson of a course with certificates on, and
 * don't hold a valid certificate for it yet (staff review queue).
 */
export async function readyToIssue() {
  const done = await db().enrollment.findMany({
    where: { status: "APPROVED", completedAt: { not: null }, course: { certificateEnabled: true }, user: { status: "ACTIVE" } },
    orderBy: { completedAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } }, course: { select: { id: true, title: true } } },
  });
  if (done.length === 0) return [];
  const existing = await db().certificate.findMany({
    where: { OR: done.map((e) => ({ userId: e.userId, courseId: e.courseId })), revokedAt: null },
    select: { userId: true, courseId: true },
  });
  const have = new Set(existing.map((c) => `${c.userId}:${c.courseId}`));
  return done.filter((e) => !have.has(`${e.userId}:${e.courseId}`));
}

export async function issueCertificate(enrollmentId: string, actor: Actor) {
  assertCanIssue(actor);
  const e = await db().enrollment.findUnique({ where: { id: enrollmentId }, include: { user: true, course: true } });
  if (!e || e.status !== "APPROVED" || !e.completedAt) throw new CertificateError("This student hasn't completed the course.");
  if (!e.course.certificateEnabled) throw new CertificateError("Certificates are turned off for this course.");
  const current = await db().certificate.findUnique({ where: { userId_courseId: { userId: e.userId, courseId: e.courseId } } });
  if (current && !current.revokedAt) throw new CertificateError("A certificate was already issued for this course.", 409);

  const data = { recipientName: e.user.name, courseTitle: e.course.title, issuedAt: new Date(), revokedAt: null };
  let cert;
  for (let attempt = 0; ; attempt++) {
    try {
      // A re-issue after revocation gets a new ID, so the old one stays invalid.
      const code = newCertificateCode();
      cert = current
        ? await db().certificate.update({ where: { id: current.id }, data: { ...data, code } })
        : await db().certificate.create({ data: { ...data, code, userId: e.userId, courseId: e.courseId } });
      break;
    } catch (err) {
      if (attempt < 3 && err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") continue;
      throw err;
    }
  }
  await audit({ actorId: actor.id, action: "certificate.issued", entityType: "Certificate", entityId: cert.id, metadata: { course: e.course.title, code: cert.code } });
  await announceCertificate(cert.id);
  return cert;
}

export async function revokeCertificate(id: string, actor: Actor) {
  assertCanIssue(actor);
  const cert = await db().certificate.findUnique({ where: { id } });
  if (!cert) throw new CertificateError("Certificate not found.", 404);
  if (cert.revokedAt) return;
  await db().certificate.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit({ actorId: actor.id, action: "certificate.revoked", entityType: "Certificate", entityId: id, metadata: { course: cert.courseTitle, code: cert.code } });
}

export function issuedCertificates(q?: string) {
  return db().certificate.findMany({
    where: q ? { OR: [{ code: { contains: q.toUpperCase() } }, { recipientName: { contains: q } }, { courseTitle: { contains: q } }] } : {},
    orderBy: { issuedAt: "desc" },
    take: 200,
    include: { user: { select: { email: true } } },
  });
}

export function certificateByCode(code: string) {
  return db().certificate.findUnique({ where: { code }, include: { course: { select: { language: true } } } });
}

export function studentCertificates(userId: string) {
  return db().certificate.findMany({ where: { userId, revokedAt: null }, orderBy: { issuedAt: "desc" } });
}

async function announceCertificate(certId: string) {
  try {
    const c = await db().certificate.findUniqueOrThrow({ where: { id: certId }, include: { user: true } });
    const locale: Locale = c.user.preferredLocale === "ur" ? "ur" : "en";
    const dict = getDictionary(locale);
    const link = `/certificates/${c.code}`;
    await notify(c.userId, { type: "CERTIFICATE_ISSUED", title: format(dict.notifications.certificateIssued, { course: c.courseTitle }), link });
    await sendMail(
      actionEmail({
        dict,
        locale,
        to: c.user.email,
        name: c.user.name,
        subject: format(dict.emails.certificateSubject, { course: c.courseTitle }),
        intro: format(dict.emails.certificateIntro, { course: c.courseTitle }),
        buttonLabel: dict.emails.certificateButton,
        url: `${siteConfig.url}${localizePath(link, locale)}`,
        ignoreNote: false,
      }),
    );
  } catch (err) {
    console.warn("[certificates] notice not sent:", err instanceof Error ? err.message : err);
  }
}

export function validCertificateFor(userId: string, courseId: string) {
  return db().certificate.findFirst({ where: { userId, courseId, revokedAt: null }, select: { code: true } });
}
