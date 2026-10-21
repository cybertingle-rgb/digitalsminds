import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { liveState, pkParts, schedulableCourses, staffLiveClasses } from "@/modules/live/service";
import { CancelLiveClass, LiveClassForm } from "./LiveForms";

export const metadata: Metadata = { title: "Live classes" };

const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

export default async function LiveClassesAdminPage() {
  const user = await requirePagePermission("admin.access", "/admin/live-classes");
  if (!can(user.role, "courses.manage.all") && !can(user.role, "courses.manage.own")) notFound();
  const [courses, upcoming, past] = await Promise.all([schedulableCourses(user), staffLiveClasses(user, "upcoming"), staffLiveClasses(user, "past")]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Live classes</h1>
        <p className="mt-1 text-muted">
          Schedule Zoom or Google Meet sessions for a course. Its enrolled students see them in their portal, can add them to their calendar, and get an email
          and notification 1 day and 1 hour before. Times are Pakistan time.
        </p>
      </div>

      <section aria-labelledby="new-class" className="glass rounded-2xl p-6">
        <h2 id="new-class" className="mb-4 text-lg font-semibold text-charcoal-900">Schedule a class</h2>
        {courses.length === 0 ? <p className="text-sm text-muted">Publish a course first; classes belong to a course.</p> : <LiveClassForm courses={courses} />}
      </section>

      <section aria-labelledby="upcoming-classes" className="space-y-3">
        <h2 id="upcoming-classes" className="text-lg font-semibold text-charcoal-900">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-muted">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((c) => {
              const state = liveState(c);
              const parts = pkParts(c.startsAt);
              return (
                <li key={c.id} className="glass rounded-2xl p-5" aria-label={c.title}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal-900" dir="auto">{c.title}</p>
                      <p className="text-sm text-muted" dir="auto">{c.course.title} · {c.course._count.enrollments} students</p>
                      <p className="mt-1 text-sm text-charcoal-800">{fmt.format(c.startsAt)} · {c.durationMinutes} min</p>
                      {c.meetingUrl && <a href={c.meetingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-sm underline underline-offset-4" dir="ltr">{c.meetingUrl}</a>}
                    </div>
                    <StatusBadge tone={state === "cancelled" ? "off" : state === "live" ? "ok" : "warn"}>{{ cancelled: "Cancelled", live: "Live now", upcoming: "Scheduled", ended: "Ended" }[state]}</StatusBadge>
                  </div>
                  {c.status === "SCHEDULED" && state !== "ended" && (
                    <div className="mt-4 space-y-3 border-t border-charcoal-200/50 pt-3">
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Edit</summary>
                        <div className="mt-3">
                          <LiveClassForm
                            id={c.id}
                            courses={[{ id: c.course.id, title: c.course.title }]}
                            value={{ courseId: c.courseId, title: c.title, description: c.description ?? "", date: parts.date, time: parts.time, durationMinutes: String(c.durationMinutes), meetingUrl: c.meetingUrl ?? "" }}
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
        <section aria-labelledby="past-classes" className="space-y-3">
          <h2 id="past-classes" className="text-lg font-semibold text-charcoal-900">Past</h2>
          <ul className="glass divide-y divide-charcoal-200/50 rounded-2xl">
            {past.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-3 p-4 text-sm">
                <span dir="auto"><span className="font-medium text-charcoal-900">{c.title}</span> · {c.course.title}</span>
                <span className="text-muted">{fmt.format(c.startsAt)}{c.status === "CANCELLED" && " · cancelled"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
