import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyField, StatusBadge } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { describeAction } from "@/modules/audit/labels";
import { enrollableCourses, getStudent, inquiriesFromEmail } from "@/modules/students/service";
import { EnrollmentActions } from "../../enrollments/EnrollmentActions";
import { DeleteStudent, EditStudentForm, ManualEnrollForm, SuspendControl } from "../StudentForms";

export const metadata: Metadata = { title: "Student" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const statusText = { REQUESTED: "Waiting for approval", APPROVED: "Enrolled", REJECTED: "Rejected", REVOKED: "Access revoked" } as const;

export default async function StudentPage({ params }: PageProps<"/[lang]/admin/students/[id]">) {
  const { id } = await params;
  const viewer = await requirePagePermission("students.view", `/admin/students/${id}`);
  const data = await getStudent(id);
  if (!data) notFound();
  const { user, enrollments, history, signIn, lastActive } = data;
  const canManage = can(viewer.role, "students.manage");
  const canDecide = can(viewer.role, "enrollments.decide");
  const courses = canDecide && user.status === "ACTIVE" ? await enrollableCourses(user.id) : [];

  const details: [string, string | null][] = [
    ["Email", user.email],
    ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Phone / WhatsApp", user.phone],
    ["City", user.city],
    ["Language", user.preferredLocale === "ur" ? "Urdu" : "English"],
    ["Signs in with", signIn.join(", ") || "-"],
    ["Joined", dateFmt.format(user.createdAt)],
    ["Last active", lastActive ? timeFmt.format(lastActive) : "Never"],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/students" className="text-sm text-muted hover:text-charcoal-900">← All students</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-charcoal-900" dir="auto">{user.name}</h1>
        {user.status === "SUSPENDED" ? <StatusBadge tone="warn">Suspended</StatusBadge> : <StatusBadge tone="ok">Active</StatusBadge>}
      </div>
      {user.status === "SUSPENDED" && (
        <p className="rounded-xl bg-sun-50 p-4 text-sm text-charcoal-900">
          Suspended {user.suspendedAt ? dateFmt.format(user.suspendedAt) : ""}{user.suspendedReason ? `: ${user.suspendedReason}` : "."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section aria-labelledby="courses" className="glass rounded-2xl p-6">
            <h2 id="courses" className="text-lg font-semibold text-charcoal-900">Courses</h2>
            {enrollments.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No course requests or enrollments yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {enrollments.map((e) => (
                  <li key={e.id} className="space-y-2 py-4" aria-label={e.course.title}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/admin/courses/${e.course.id}`} className="font-medium text-charcoal-900 hover:underline" dir="auto">{e.course.title}</Link>
                      <StatusBadge tone={e.status === "APPROVED" ? "ok" : e.status === "REQUESTED" ? "warn" : "off"}>{statusText[e.status]}</StatusBadge>
                    </div>
                    {e.status === "APPROVED" && (
                      <div>
                        <div className="h-2 overflow-hidden rounded-full bg-charcoal-100" role="progressbar" aria-valuemin={0} aria-valuemax={e.total} aria-valuenow={e.done} aria-label={`${e.course.title} progress`}>
                          <div className="h-full rounded-full bg-sun-400" style={{ width: `${e.total ? Math.round((e.done / e.total) * 100) : 0}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {e.done} of {e.total} lessons complete{e.completedAt && ` · completed ${dateFmt.format(e.completedAt)}`}
                          {e.lastViewed && ` · last viewed “${e.lastViewed.title}” ${timeFmt.format(e.lastViewed.at)}`}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted">
                      Requested {dateFmt.format(e.requestedAt)}
                      {e.decidedAt && ` · decided ${dateFmt.format(e.decidedAt)}${e.decidedBy ? ` by ${e.decidedBy.name}` : ""}`}
                    </p>
                    {e.requestNote && <p className="text-sm text-charcoal-800" dir="auto">Student&apos;s note: “{e.requestNote}”</p>}
                    {e.decisionNote && <p className="text-sm text-charcoal-800" dir="auto">Note to student: {e.decisionNote}</p>}
                    {canDecide && <EnrollmentActions id={e.id} status={e.status} student={user.name} />}
                  </li>
                ))}
              </ul>
            )}
            {canDecide && user.status === "ACTIVE" && (
              <div className="mt-4 border-t border-line pt-4">
                <ManualEnrollForm id={user.id} courses={courses} />
              </div>
            )}
          </section>

          <section aria-labelledby="history" className="glass rounded-2xl p-6">
            <h2 id="history" className="text-lg font-semibold text-charcoal-900">History</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nothing recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-sm">
                {history.map((h) => {
                  const course = (h.metadata as { course?: unknown } | null)?.course;
                  return (
                    <li key={h.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {describeAction(h.action)}
                        {typeof course === "string" && <span className="text-muted" dir="auto"> · {course}</span>}
                        <span className="text-muted"> · {h.actor?.name ?? "System"}</span>
                      </span>
                      <span className="text-xs text-muted">{timeFmt.format(h.createdAt)}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section aria-labelledby="profile" className="space-y-4 glass rounded-2xl p-6">
            <h2 id="profile" className="text-lg font-semibold text-charcoal-900">Profile</h2>
            <CopyField label="Google email (share videos with)" value={user.googleEmail ?? user.email} />
            <dl className="space-y-2 text-sm">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words text-charcoal-900" dir="auto">{v ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </section>

          {canManage && (
            <section aria-labelledby="manage" className="space-y-4 glass rounded-2xl p-6">
              <h2 id="manage" className="text-lg font-semibold text-charcoal-900">Manage account</h2>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-charcoal-900">Edit details</summary>
                <div className="mt-4">
                  <EditStudentForm id={user.id} name={user.name} googleEmail={user.googleEmail ?? ""} phone={user.phone ?? ""} city={user.city ?? ""} />
                </div>
              </details>
              <SuspendControl id={user.id} suspended={user.status === "SUSPENDED"} />
              {can(viewer.role, "students.export") && <DeleteStudent id={user.id} email={user.email} inquiries={await inquiriesFromEmail(user.email)} />}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
