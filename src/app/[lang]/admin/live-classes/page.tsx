import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { joinUrl, liveState, schedulableBatches, staffLiveClasses } from "@/modules/live/service";
import { DEFAULT_TIME_ZONE, zonedParts, zoneLabel } from "@/lib/timezone";
import { CancelLiveClass, LiveClassForm } from "./LiveForms";

export const metadata: Metadata = { title: "Schedule" };

const fmt = (tz: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz });
const dayFmt = (tz: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: tz });
const KIND = { CLASS: "Class", HOLIDAY: "Holiday", EVENT: "Event" } as const;

export default async function ScheduleAdminPage({ searchParams }: PageProps<"/[lang]/admin/live-classes">) {
  const user = await requirePagePermission("admin.access", "/admin/live-classes");
  if (!can(user.role, "batches.manage") && !can(user.role, "batches.coordinate")) notFound();
  const sp = await searchParams;
  const batchId = typeof sp.batch === "string" ? sp.batch.slice(0, 64) : undefined;
  const [batches, upcoming, past] = await Promise.all([schedulableBatches(user), staffLiveClasses(user, "upcoming", batchId), staffLiveClasses(user, "past", batchId)]);
  const options = batches.map((b) => ({ id: b.id, label: `${b.name} (${b.code}) · ${b.course.title} · times in ${b.timeZone.replace(/_/g, " ")}`, hasLink: !!b.meetingUrl }));
  // Times are shown in each batch's own zone.
  const when = (c: { kind: string; startsAt: Date; batch: { timeZone: string } | null }) => {
    const tz = c.batch?.timeZone ?? DEFAULT_TIME_ZONE;
    return c.kind === "HOLIDAY" ? dayFmt(tz).format(c.startsAt) : `${fmt(tz).format(c.startsAt)} ${zoneLabel(tz, c.startsAt)}`;
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Schedule</h1>
        <p className="mt-1 text-muted">
          Live classes, holidays and events for each batch. The batch&apos;s students see them in their portal, can add classes to their calendar, and get an email
          and notification 1 day and 1 hour before a class. Holidays and changes are emailed straight away. Times are Pakistan time.
        </p>
      </div>

      <nav aria-label="Filter by batch" className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/live-classes" aria-current={!batchId ? "page" : undefined} className={`rounded-full px-3 py-1.5 font-medium ${!batchId ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800"}`}>All batches</Link>
        {batches.map((b) => (
          <Link key={b.id} href={`/admin/live-classes?batch=${b.id}`} aria-current={batchId === b.id ? "page" : undefined} className={`rounded-full px-3 py-1.5 font-medium ${batchId === b.id ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800"}`}>{b.code}</Link>
        ))}
      </nav>

      <section aria-labelledby="new-session" className="glass rounded-2xl p-6">
        <h2 id="new-session" className="mb-4 text-lg font-semibold text-charcoal-900">Add to a batch&apos;s schedule</h2>
        {options.length === 0 ? <p className="text-sm text-muted">Open a batch first; sessions belong to a batch.</p> : <LiveClassForm batches={options} value={batchId ? { batchId, kind: "CLASS", title: "", description: "", date: "", time: "", durationMinutes: "60", meetingUrl: "" } : undefined} />}
      </section>

      <section aria-labelledby="upcoming-sessions" className="space-y-3">
        <h2 id="upcoming-sessions" className="text-lg font-semibold text-charcoal-900">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-muted">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((c) => {
              const state = liveState(c);
              const parts = zonedParts(c.startsAt, c.batch?.timeZone ?? DEFAULT_TIME_ZONE);
              const link = joinUrl(c);
              return (
                <li key={c.id} className="glass rounded-2xl p-5" aria-label={c.title}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal-900" dir="auto">{c.title}</p>
                      <p className="text-sm text-muted" dir="auto">{c.batch ? `${c.batch.name} · ${c.batch._count.enrollments} students` : c.course.title} · {KIND[c.kind]}</p>
                      <p className="mt-1 text-sm text-charcoal-800">{when(c)}{c.kind !== "HOLIDAY" && ` · ${c.durationMinutes} min`}</p>
                      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-sm underline underline-offset-4" dir="ltr">{link}</a>}
                    </div>
                    <StatusBadge tone={state === "cancelled" ? "off" : state === "live" ? "ok" : "warn"}>{{ cancelled: "Cancelled", live: c.kind === "HOLIDAY" ? "Today" : "Live now", upcoming: "Scheduled", ended: "Ended" }[state]}</StatusBadge>
                  </div>
                  {c.status === "SCHEDULED" && state !== "ended" && c.batch && (
                    <div className="mt-4 space-y-3 border-t border-charcoal-200/50 pt-3">
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Edit</summary>
                        <div className="mt-3">
                          <LiveClassForm
                            id={c.id}
                            batches={[{ id: c.batch.id, label: `${c.batch.name} (${c.batch.code}) · times in ${c.batch.timeZone.replace(/_/g, " ")}`, hasLink: !!c.batch.meetingUrl }]}
                            value={{ batchId: c.batch.id, kind: c.kind, title: c.title, description: c.description ?? "", date: parts.date, time: parts.time, durationMinutes: String(c.durationMinutes), meetingUrl: c.meetingUrl ?? "" }}
                          />
                        </div>
                      </details>
                      <CancelLiveClass id={c.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-sessions" className="space-y-3">
          <h2 id="past-sessions" className="text-lg font-semibold text-charcoal-900">Past</h2>
          <ul className="glass divide-y divide-charcoal-200/50 rounded-2xl">
            {past.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                <span dir="auto"><span className="font-medium text-charcoal-900">{c.title}</span> · {c.batch?.name ?? c.course.title}</span>
                <span className="text-muted">{when(c)}{c.status === "CANCELLED" && " · cancelled"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
