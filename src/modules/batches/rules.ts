import type { BatchStatus, EnrollmentStage } from "@/generated/prisma/client";

/**
 * Pure batch rules (no database), shared by pages and services.
 * A seat is taken when a Super Admin verifies the payment; it is given back if
 * the student withdraws.
 */
export const SEAT_STAGES = ["ENROLLMENT_CONFIRMED", "ONBOARDING", "ACTIVE", "COMPLETED"] as const satisfies readonly EnrollmentStage[];

/** Batches shown on the public program page. */
export const PUBLIC_BATCH_STATUSES = ["OPEN", "CLOSED", "IN_PROGRESS"] as const satisfies readonly BatchStatus[];

export type Availability = "open" | "full" | "deadline" | "closed";

/** Whether a batch takes applications now. `today` is the PKT calendar day ("YYYY-MM-DD"). */
export function availability(
  batch: { status: BatchStatus; capacity: number; applicationDeadline: Date | null; startDate: Date },
  taken: number,
  today: string,
): Availability {
  if (batch.status !== "OPEN") return "closed";
  if (taken >= batch.capacity) return "full";
  const deadline = batch.applicationDeadline ?? batch.startDate;
  if (isoDay(deadline) < today) return "deadline";
  return "open";
}

export function seatsLeft(capacity: number, taken: number) {
  return Math.max(0, capacity - taken);
}

/** A @db.Date value as "YYYY-MM-DD". */
export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> the Date Prisma stores for a @db.Date column. */
export function dateOnly(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

/** "12 Jan 2027" for a @db.Date value (stored at UTC midnight). */
export function formatDay(d: Date, intl = "en-US") {
  return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
