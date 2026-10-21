import { createHash, randomBytes, randomInt } from "node:crypto";
import type { EnrollmentStage } from "@/generated/prisma/client";

/**
 * Pure admissions rules: stage order, references, private status-link tokens,
 * CNIC format and the files applicants may upload.
 */

/** The journey in order (side exits WITHDRAWN / REJECTED / CANCELLED are not on the main path). */
export const STAGE_PATH = [
  "APPLICATION_RECEIVED",
  "PAYMENT_PENDING",
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFIED",
  "ENROLLMENT_CONFIRMED",
  "ONBOARDING",
  "ACTIVE",
  "COMPLETED",
] as const satisfies readonly EnrollmentStage[];

/** Applications still waiting on the applicant or on payment verification. */
export const OPEN_APPLICATION_STAGES = ["APPLICATION_RECEIVED", "PAYMENT_PENDING", "PAYMENT_SUBMITTED"] as const satisfies readonly EnrollmentStage[];

export const CLOSED_STAGES = ["WITHDRAWN", "REJECTED", "CANCELLED"] as const satisfies readonly EnrollmentStage[];

/** Position of a stage on the main path (-1 for side exits). */
export function stageIndex(stage: EnrollmentStage) {
  return (STAGE_PATH as readonly string[]).indexOf(stage);
}

/** Crockford-style alphabet: no 0/O, 1/I/L or U, so references are easy to read out on the phone. */
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

/** "DM-7KQ4-XZ2M". */
export function newReference() {
  const pick = () => Array.from({ length: 4 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");
  return `DM-${pick()}-${pick()}`;
}

export function normaliseReference(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}

/** A new private status-link token (only its hash is stored). */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** True for the shape of a token we issued (avoids hashing junk). */
export function looksLikeToken(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
}

/** "3520212345671" or "35202-1234567-1" -> "35202-1234567-1"; null if not 13 digits. */
export function formatCnic(v: string): string | null {
  const digits = v.replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** "35202-*******-1" for places that only need to recognise it. */
export function maskCnic(cnic: string) {
  return cnic.replace(/^(\d{5})-\d{7}-(\d)$/, "$1-*******-$2");
}

/** Key that makes a payment's transaction unique: same method + same reference = same money. */
export function transactionKey(method: string, reference: string) {
  return `${method}:${reference.trim().toUpperCase().replace(/[\s-]/g, "")}`.slice(0, 120);
}

export const CV_MAX_BYTES = 5 * 1024 * 1024;
/** PDF and Word (.docx) only; checked by content, not by name. */
export const CV_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
