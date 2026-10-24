/**
 * Time-zone helpers built on Intl (no dependency). Batches set their class
 * times in their own IANA zone; times are stored in UTC.
 */

export const DEFAULT_TIME_ZONE = "Asia/Karachi";

/** Zones offered in the batch editor (any valid IANA zone is accepted). */
export const COMMON_TIME_ZONES = [
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Qatar",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Kuala_Lumpur",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "Europe/Istanbul",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
] as const;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `d` in `tz`. */
export function zonedParts(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, second: Number(p.second) };
}

/** Offset of `tz` from UTC at instant `d`, in minutes (e.g. +300 for Karachi). */
function offsetMinutes(d: Date, tz: string) {
  const { date, time, second } = zonedParts(d, tz);
  const asUtc = Date.parse(`${date}T${time}:${String(second).padStart(2, "0")}Z`);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The UTC instant of wall-clock `date` + `time` in `tz`. Around a DST change a
 * skipped time moves forward and a repeated time takes the first occurrence.
 */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  // Try the offsets in force half a day either side; these cover any single change.
  const before = naive - offsetMinutes(new Date(naive - 12 * 3600_000), tz) * 60_000;
  const after = naive - offsetMinutes(new Date(naive + 12 * 3600_000), tz) * 60_000;
  const matches = [before, after].filter((t) => {
    const p = zonedParts(new Date(t), tz);
    return p.date === date && p.time === time;
  });
  // Repeated hour: the first occurrence. Skipped hour: read with the earlier offset, which lands after the gap.
  return new Date(matches.length ? Math.min(...matches) : before);
}

/** Short zone name for labels, e.g. "PKT", "GMT+4", "BST". */
export function zoneLabel(tz: string, at = new Date()): string {
  if (tz === "Asia/Karachi") return "PKT";
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
  return name ?? tz;
}

/** "PKT · Karachi", "GMT+4 · Dubai" for public labels. */
export function zoneName(tz: string, at = new Date()): string {
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  const label = zoneLabel(tz, at);
  return label === city ? label : `${label} · ${city}`;
}
