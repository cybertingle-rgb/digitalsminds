import type { ReactNode } from "react";
import type { EnrollmentStage } from "@/generated/prisma/client";
import { localeMeta, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { format } from "@/i18n/merge";
import { STAGE_PATH, stageIndex } from "@/modules/admissions/rules";
import { formatDay } from "@/modules/batches/rules";
import type { MyEnrollment } from "@/modules/portal/service";

/** Page heading used across the portal. */
export function PortalHeading({ title, intro, children }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-charcoal-900">{title}</h1>
        {intro && <p className="mt-1 max-w-3xl text-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

/** The 8 stages with the ones reached ticked (dates from the recorded events). */
export function StageTimeline({ e, dict, locale }: { e: MyEnrollment; dict: Dictionary; locale: Locale }) {
  const t = dict.apply.stages;
  const reached = new Map<EnrollmentStage, Date>();
  for (const ev of [...(e.application?.events ?? []), ...e.events]) if (!reached.has(ev.stage)) reached.set(ev.stage, ev.createdAt);
  const current = stageIndex(e.effective);
  const exited = current === -1;
  const fmt = new Intl.DateTimeFormat(localeMeta[locale].intl, { dateStyle: "medium", timeZone: "Asia/Karachi" });
  return (
    <ol className="space-y-3" aria-label={dict.portal.timeline}>
      {STAGE_PATH.map((s, i) => {
        const done = !exited ? current >= i : reached.has(s);
        const at = reached.get(s);
        return (
          <li key={s} className="flex gap-3" aria-current={e.effective === s ? "step" : undefined}>
            <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-charcoal-900 text-sun-400" : "bg-charcoal-100 text-charcoal-500"}`}>{done ? "✓" : i + 1}</span>
            <span>
              <span className={`block text-sm ${e.effective === s ? "font-bold text-charcoal-900" : done ? "text-charcoal-900" : "text-muted"}`}>{t[s]}</span>
              {at && done && <span className="block text-xs text-muted">{fmt.format(at)}</span>}
            </span>
          </li>
        );
      })}
      {exited && (
        <li className="flex gap-3" aria-current="step">
          <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">×</span>
          <span className="text-sm font-bold text-charcoal-900">{t[e.effective]}</span>
        </li>
      )}
    </ol>
  );
}

/** Dates, class times, format and coordinator of the student's batch. */
export function BatchFacts({ e, dict }: { e: MyEnrollment; dict: Dictionary }) {
  const p = dict.portal;
  const b = e.batch;
  const rows: [string, ReactNode][] = [
    ...(b ? ([[p.batch, `${b.name} (${b.code})`], [p.dates, `${formatDay(b.startDate)}${b.endDate ? ` – ${formatDay(b.endDate)}` : ""}`], [p.classTimes, b.scheduleText]] as [string, ReactNode][]) : []),
    [p.format, dict.courses.formats[e.course.format]],
    ...(e.course.durationText ? ([[dict.apply.duration, e.course.durationText]] as [string, ReactNode][]) : []),
    ...(b?.coordinator ? ([[p.coordinator, b.coordinator.name]] as [string, ReactNode][]) : []),
    ...(e.application ? ([[p.reference, <span key="ref" className="font-mono" dir="ltr">{e.application.reference}</span>]] as [string, ReactNode][]) : []),
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="font-medium text-charcoal-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function stageHelp(e: MyEnrollment, dict: Dictionary) {
  return (dict.portal.stageHelp as Partial<Record<EnrollmentStage, string>>)[e.effective] ?? dict.apply.stageHelp[e.effective];
}

/** "Batch 7 · starts 10 Jan 2027". */
export function batchLine(e: MyEnrollment, dict: Dictionary) {
  return e.batch ? `${e.batch.name} · ${format(dict.apply.starts, { date: formatDay(e.batch.startDate) })}` : null;
}
