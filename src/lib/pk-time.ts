/**
 * Pakistan Standard Time helpers (UTC+5, no daylight saving). Follow-up dates
 * are calendar days in Pakistan, stored as that day's midnight PKT.
 */
const OFFSET_MS = 5 * 60 * 60 * 1000;

/** "2026-10-19" -> Date for 2026-10-19 00:00 PKT. */
export function pkDayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+05:00`);
}

/** The PKT calendar day ("YYYY-MM-DD") containing `date`. */
export function pkDay(date: Date = new Date()): string {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of today and tomorrow in PKT. */
export function pkTodayRange(now: Date = new Date()) {
  const start = pkDayStart(pkDay(now));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
