import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";

/** "1 h 30 min" in the visitor's language. */
export function formatDuration(minutes: number | null | undefined, dict: Pick<Dictionary, "courses">): string | null {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && format(dict.courses.hours, { hours: String(h) }), m && format(dict.courses.minutes, { minutes: String(m) })].filter(Boolean).join(" ");
}

export function lessonCount(count: number, dict: Pick<Dictionary, "courses">) {
  return count === 1 ? dict.courses.oneLesson : format(dict.courses.lessons, { count: String(count) });
}
