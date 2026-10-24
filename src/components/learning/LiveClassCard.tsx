import { localeMeta, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { DEFAULT_TIME_ZONE, zoneLabel } from "@/lib/timezone";
import { liveState } from "@/modules/live/service";
import { LocalTime } from "./LocalTime";

type Live = {
  id: string;
  kind: "CLASS" | "HOLIDAY" | "EVENT";
  title: string;
  description: string | null;
  startsAt: Date;
  durationMinutes: number;
  meetingUrl: string | null;
  status: string;
  course: { title: string; titleUr: string | null };
  batch?: { name: string; timeZone?: string } | null;
};

export type AttendanceMark = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

/** A session on the student's schedule: time, join button (from 15 minutes before) and "add to calendar". Holidays show the day only. */
export function LiveClassCard({ c, locale, dict, compact = false, attendance }: { c: Live; locale: Locale; dict: Dictionary; compact?: boolean; attendance?: AttendanceMark | null }) {
  const t = dict.live;
  const state = liveState(c);
  const holiday = c.kind === "HOLIDAY";
  const where = c.batch?.name ?? ((locale === "ur" && c.course.titleUr) || c.course.title);
  const tz = c.batch?.timeZone ?? DEFAULT_TIME_ZONE;
  const day = new Intl.DateTimeFormat(localeMeta[locale].intl, { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(c.startsAt);
  const time = new Intl.DateTimeFormat(localeMeta[locale].intl, { hour: "numeric", minute: "2-digit", timeZone: tz }).format(c.startsAt);
  return (
    <div className={`flex flex-wrap items-center gap-4 ${state === "cancelled" ? "opacity-70" : ""}`}>
      <div className={`flex w-24 shrink-0 flex-col items-center rounded-2xl px-2 py-2.5 text-center ${holiday ? "bg-sun-100 text-charcoal-900" : state === "live" ? "bg-sun-400" : "bg-charcoal-900 text-white"}`}>
        <span className="text-[11px] font-semibold uppercase tracking-wider">{day}</span>
        <span className="text-sm font-bold" dir="ltr">{holiday ? t.holiday : time}</span>
        {!holiday && <span className="text-[10px] font-semibold opacity-80" dir="ltr">{zoneLabel(tz, c.startsAt)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-charcoal-900" dir="auto">
          {c.title}
          {state === "live" && !holiday && <span className="ms-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-white">{t.liveNow}</span>}
          {c.kind === "EVENT" && <span className="ms-2 rounded-full bg-sun-100 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-charcoal-900">{t.event}</span>}
          {state === "cancelled" && <span className="ms-2 rounded-full bg-charcoal-200 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-charcoal-800">{t.cancelled}</span>}
        </p>
        <p className="text-sm text-muted" dir="auto">{where} · {holiday ? t.noClass : format(t.minutes, { minutes: String(c.durationMinutes) })}</p>
        {!holiday && state !== "ended" && state !== "cancelled" && <LocalTime at={c.startsAt.toISOString()} zone={tz} label={t.yourTime} locale={localeMeta[locale].intl} />}
        {attendance && <p className="mt-1 text-xs font-semibold text-charcoal-800">{t.attendanceLabel}: {t.attendance[attendance]}</p>}
        {!compact && c.description && <p className="mt-1 whitespace-pre-line text-sm text-charcoal-800" dir="auto">{c.description}</p>}
      </div>
      {!holiday && state !== "cancelled" && state !== "ended" && (
        <div className="flex flex-wrap items-center gap-2">
          {state === "live" && c.meetingUrl ? (
            <a href={c.meetingUrl} target="_blank" rel="noopener noreferrer" className="border-run rounded-xl bg-sun-400 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-sun-500">{t.join}</a>
          ) : c.meetingUrl ? (
            <span className="rounded-xl bg-charcoal-100 px-4 py-2 text-sm font-semibold text-charcoal-500" title={t.joinSoon} aria-label={`${t.join}: ${t.joinSoon}`}>{t.join}</span>
          ) : null}
          <a href={`/api/live/${c.id}/ics`} className="rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-sm font-semibold text-charcoal-900 hover:bg-white/90">{t.addToCalendar}</a>
        </div>
      )}
    </div>
  );
}
