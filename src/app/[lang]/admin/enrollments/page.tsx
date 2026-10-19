import type { Metadata } from "next";
import Link from "next/link";
import { CopyField, StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/modules/auth/session";
import { driveFileId, driveViewUrl } from "@/modules/courses/drive";
import { listEnrollments, parseQueueFilter, type EnrollmentStatus } from "@/modules/learning/enrollment";
import { EnrollmentActions } from "./EnrollmentActions";

export const metadata: Metadata = { title: "Enrollments" };

const PAGE_SIZE = 25;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const tabs: { status: EnrollmentStatus; label: string }[] = [
  { status: "REQUESTED", label: "Waiting" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
  { status: "REVOKED", label: "Revoked" },
];

export default async function EnrollmentsPage({ searchParams }: PageProps<"/[lang]/admin/enrollments">) {
  await requirePagePermission("enrollments.decide", "/admin/enrollments");
  const sp = await searchParams;
  const filter = parseQueueFilter(sp);
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const [{ items, total, byStatus }, courses] = await Promise.all([
    listEnrollments(filter, page, PAGE_SIZE),
    db().course.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status: filter.status, course: filter.courseId, q: filter.q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/admin/enrollments?${p}`;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Enrollments</h1>
        <p className="mt-1 text-muted">
          Students ask to join a course; approve them here. Share the course&apos;s Drive videos with the student&apos;s Google email
          (in Drive: Share → add the email as Viewer), then approve. Approved students get an email and can start straight away.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.status}
            href={qs({ status: t.status, page: undefined })}
            aria-current={filter.status === t.status ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter.status === t.status ? "bg-charcoal-900 text-white" : "border border-line bg-white text-charcoal-800 hover:bg-charcoal-50"}`}
          >
            {t.label} ({byStatus[t.status] ?? 0})
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="status" value={filter.status} />
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-charcoal-900">Search</label>
          <input id="q" name="q" defaultValue={filter.q} placeholder="Name or email" className={`${inputClass} w-64`} />
        </div>
        <div>
          <label htmlFor="course" className="block text-sm font-medium text-charcoal-900">Course</label>
          <select id="course" name="course" defaultValue={filter.courseId ?? ""} className={`${inputClass} max-w-72`}>
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white">Apply</button>
      </form>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-charcoal-200 bg-white p-8 text-center text-muted">
          {filter.status === "REQUESTED" ? "No requests waiting. New requests appear here and are emailed to the lead alert address." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((e) => {
            const videos = e.course.modules.flatMap((m) => m.lessons).filter((l) => l.videoUrl && driveFileId(l.videoUrl));
            return (
              <li key={e.id} className="rounded-2xl border border-line bg-white p-5" aria-label={`${e.user.name}: ${e.course.title}`}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="min-w-0 space-y-2 text-sm">
                    <p className="text-base font-semibold text-charcoal-900" dir="auto">
                      {e.user.name} {e.user.status === "SUSPENDED" && <StatusBadge tone="warn">Suspended</StatusBadge>}
                    </p>
                    <p className="truncate text-muted" dir="ltr">{e.user.email}</p>
                    {(e.user.city || e.user.phone) && <p className="text-muted">{[e.user.city, e.user.phone].filter(Boolean).join(" · ")}</p>}
                    <p>
                      Course: <Link href={`/admin/courses/${e.course.id}`} className="font-medium text-charcoal-900 underline underline-offset-4" dir="auto">{e.course.title}</Link>
                      {e.course.status !== "PUBLISHED" && <span className="ms-2"><StatusBadge tone="off">{e.course.status === "ARCHIVED" ? "Archived" : "Draft"}</StatusBadge></span>}
                    </p>
                    <p className="text-xs text-muted">
                      Requested {dateFmt.format(e.requestedAt)}
                      {e.decidedAt && ` · ${e.status === "APPROVED" ? "approved" : e.status === "REJECTED" ? "rejected" : "revoked"} ${dateFmt.format(e.decidedAt)}${e.decidedBy ? ` by ${e.decidedBy.name}` : ""}`}
                    </p>
                    {e.requestNote && <p className="rounded-lg bg-surface-alt p-3 text-charcoal-800" dir="auto">“{e.requestNote}”</p>}
                    {e.decisionNote && <p className="text-charcoal-800" dir="auto">Note to student: {e.decisionNote}</p>}
                  </div>
                  <div className="min-w-0 space-y-4">
                    <CopyField label="Google email (share videos with)" value={e.user.googleEmail ?? e.user.email} />
                    {e.status === "REQUESTED" && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium text-charcoal-900">Drive videos in this course ({videos.length})</summary>
                        {videos.length ? (
                          <ul className="mt-2 space-y-1">
                            {videos.map((v) => (
                              <li key={v.videoUrl}>
                                <a href={driveViewUrl(driveFileId(v.videoUrl!)!)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" dir="auto">{v.title}</a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-muted">No videos yet.</p>
                        )}
                        <p className="mt-2 text-xs text-muted">Tip: keep a course&apos;s videos in one Drive folder and share the folder once per student.</p>
                      </details>
                    )}
                    <EnrollmentActions id={e.id} status={e.status} student={e.user.name} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="underline">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="underline">Next</Link>}
        </nav>
      )}
    </div>
  );
}
