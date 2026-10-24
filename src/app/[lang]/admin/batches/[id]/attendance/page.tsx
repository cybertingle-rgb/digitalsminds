import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/admin/ui";
import { zoneLabel } from "@/lib/timezone";
import { attendanceSheet, AttendanceError, batchAttendance } from "@/modules/attendance/service";
import { requirePagePermission } from "@/modules/auth/session";
import { AttendanceForm } from "./AttendanceForm";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ params, searchParams }: PageProps<"/[lang]/admin/batches/[id]/attendance">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/batches/${id}/attendance`);
  const sp = await searchParams;
  const classId = typeof sp.class === "string" ? sp.class : null;
  const overview = await batchAttendance(id, user).catch((e) => {
    if (e instanceof AttendanceError) return null;
    throw e;
  });
  if (!overview) notFound();
  const { batch, classes, students } = overview;
  const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: batch.timeZone });
  const sheet = classId ? await attendanceSheet(id, classId, user).catch(() => null) : null;

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={`/admin/batches/${batch.id}`} className="text-sm text-muted hover:text-charcoal-900">← {batch.name}</Link>
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Attendance · {batch.name}</h1>
        <p className="mt-1 text-muted">{batch.course.title} · {students} students · times in {batch.timeZone.replace(/_/g, " ")}</p>
      </div>
      {!batch.attendanceEnabled && <Notice tone="info">Attendance is switched off for this batch. Switch it on in the batch settings to record it; earlier records stay visible here.</Notice>}

      {sheet ? (
        <section aria-labelledby="sheet" className="glass rounded-2xl p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="sheet" className="text-lg font-semibold text-charcoal-900">{sheet.live.title}</h2>
              <p className="text-sm text-muted">{fmt.format(sheet.live.startsAt)} {zoneLabel(batch.timeZone, sheet.live.startsAt)} · {sheet.live.durationMinutes} min</p>
            </div>
            <Link href={`/admin/batches/${batch.id}/attendance`} className="text-sm underline">All classes</Link>
          </div>
          {sheet.rows.length === 0 ? (
            <p className="text-sm text-muted">No students in this batch yet.</p>
          ) : (
            <AttendanceForm batchId={batch.id} liveClassId={sheet.live.id} disabled={!batch.attendanceEnabled} rows={sheet.rows.map((r) => ({ id: r.id, name: r.user.name, email: r.user.email, status: r.status, note: r.note }))} />
          )}
        </section>
      ) : classId ? (
        <Notice tone="error">That class can&apos;t be marked (not found, not started yet, cancelled or a holiday).</Notice>
      ) : null}

      <section aria-labelledby="classes" className="space-y-3">
        <h2 id="classes" className="text-lg font-semibold text-charcoal-900">Classes so far ({classes.length})</h2>
        {classes.length === 0 ? (
          <p className="glass-subtle rounded-2xl p-6 text-muted">No classes have taken place yet. Attendance can be marked once a class has started.</p>
        ) : (
          <ul className="space-y-2">
            {classes.map((c) => (
              <li key={c.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal-900">{c.title}</p>
                  <p className="text-xs text-muted">{fmt.format(c.startsAt)} · {c.marked ? `${c.attended} attended of ${c.marked} marked` : "Not marked yet"}</p>
                </div>
                <Link href={`/admin/batches/${batch.id}/attendance?class=${c.id}`} className="rounded-xl border border-white/80 bg-white/60 px-3 py-1.5 text-sm font-semibold text-charcoal-900 hover:bg-white/90">
                  {c.marked ? "Review" : "Mark"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
