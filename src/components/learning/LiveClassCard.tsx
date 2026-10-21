import { localeMeta, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { liveState } from "@/modules/live/service";

type Live = { id: string; title: string; description: string | null; startsAt: Date; durationMinutes: number; meetingUrl: string; status: string; course: { title: string; titleUr: string | null } };

/** A live class for a student: time, join button (from 15 minutes before) and "add to calendar". */
export function LiveClassCard({ c, locale, dict, compact = false }: { c: Live; locale: Locale; dict: Dictionary; compact?: boolean }) {
  const t = dict.live;
  const state = liveState(c);
  const course = (locale === "ur" && c.course.titleUr) || c.course.title;
  const day = new Intl.DateTimeFormat(localeMeta[locale].intl, { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Karachi" }).format(c.startsAt);
  const time = new Intl.DateTimeFormat(localeMeta[locale].intl, { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }).format(c.startsAt);
  return (
    <div className={`flex flex-wrap items-center gap-4 ${state === "cancelled" ? "opacity-70" : ""}`}>
      <div className={`flex w-24 shrink-0 flex-col items-center rounded-2xl px-2 py-2.5 text-center ${state === "live" ? "bg-sun-400" : "bg-charcoal-900 text-white"}`}>
        <span className="text-[11px] font-semibold uppercase tracking-wider">{day}</span>
        <span className="text-sm font-bold" dir="ltr">{time}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-charcoal-900" dir="auto">
          {c.title}
          {state === "live" && <span className="ms-2 rounded-full bg-red-600 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-white">{t.liveNow}</span>}
          {state === "cancelled" && <span className="ms-2 rounded-full bg-charcoal-200 px-2 py-0.5 align-middle text-[11px] font-bold uppercase text-charcoal-800">{t.cancelled}</span>}
        </p>
        <p className="text-sm text-muted" dir="auto">{course} · {format(t.minutes, { minutes: String(c.durationMinutes) })}</p>
        {!compact && c.description && <p className="mt-1 whitespace-pre-line text-sm text-charcoal-800" dir="auto">{c.description}</p>}
      </div>
      {state !== "cancelled" && state !== "ended" && (
        <div className="flex flex-wrap items-center gap-2">
          {state === "live" ? (
            <a href={c.meetingUrl} target="_blank" rel="noopener noreferrer" className="border-run rounded-xl bg-sun-400 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-sun-500">{t.join}</a>
          ) : (
            <span className="rounded-xl bg-charcoal-100 px-4 py-2 text-sm font-semibold text-charcoal-500" title={t.joinSoon} aria-label={`${t.join}: ${t.joinSoon}`}>{t.join}</span>
          )}
          <a href={`/api/live/${c.id}/ics`} className="rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-sm font-semibold text-charcoal-900 hover:bg-white/90">{t.addToCalendar}</a>
        </div>
      )}
    </div>
  );
}
