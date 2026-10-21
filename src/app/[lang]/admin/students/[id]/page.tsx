import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { describeAction } from "@/modules/audit/labels";
import { getStudent, inquiriesFromEmail } from "@/modules/students/service";
import { getDictionary } from "@/i18n/get-dictionary";
import { DeleteStudent, EditStudentForm, SuspendControl } from "../StudentForms";

export const metadata: Metadata = { title: "Student" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const statusText = { REQUESTED: "Requested (old flow)", APPROVED: "Enrolled", REJECTED: "Rejected", REVOKED: "Access revoked" } as const;

export default async function StudentPage({ params }: PageProps<"/[lang]/admin/students/[id]">) {
  const { id } = await params;
  const viewer = await requirePagePermission("students.view", `/admin/students/${id}`);
  const data = await getStudent(id);
  if (!data) notFound();
  const { user, enrollments, applications, history, signIn, lastActive } = data;
  const stages = getDictionary("en").apply.stages;
  const canManage = can(viewer.role, "students.manage");

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
            <h2 id="courses" className="text-lg font-semibold text-charcoal-900">Enrollments</h2>
            {enrollments.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No enrollments.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {enrollments.map((e) => (
                  <li key={e.id} className="space-y-2 py-4" aria-label={e.course.title}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <Link href={`/admin/courses/${e.course.id}`} className="font-medium text-charcoal-900 hover:underline" dir="auto">{e.course.title}</Link>
                        {e.batch && (
                          <span className="text-sm text-muted"> · <Link href={`/admin/batches/${e.batch.id}`} className="underline underline-offset-4">{e.batch.name}</Link></span>
                        )}
                      </span>
                      <StatusBadge tone={e.stage === "ACTIVE" || e.stage === "COMPLETED" || (!e.stage && e.status === "APPROVED") ? "ok" : e.stage === "WITHDRAWN" || e.status === "REVOKED" ? "off" : "warn"}>
                        {e.stage ? stages[e.stage] : statusText[e.status]}
                      </StatusBadge>
                    </div>
                    {e.events.length > 0 && (
                      <ol className="space-y-1 text-xs text-muted">
                        {e.events.map((ev) => (
                          <li key={ev.id}>
                            {stages[ev.stage]} · {timeFmt.format(ev.createdAt)}{ev.actor ? ` · ${ev.actor.name}` : ""}
                            {ev.note && <span className="text-charcoal-800" dir="auto"> · {ev.note}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                    {e.decisionNote && <p className="text-sm text-charcoal-800" dir="auto">Note: {e.decisionNote}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {applications.length > 0 && (
            <section aria-labelledby="apps" className="glass rounded-2xl p-6">
              <h2 id="apps" className="text-lg font-semibold text-charcoal-900">Applications</h2>
              <ul className="mt-3 divide-y divide-line text-sm">
                {applications.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {can(viewer.role, "applications.view") ? (
                        <Link href={`/admin/applications/${a.id}`} className="font-mono underline underline-offset-4" dir="ltr">{a.reference}</Link>
                      ) : (
                        <span className="font-mono" dir="ltr">{a.reference}</span>
                      )}
                      <span className="text-muted"> · {a.course.title} · {a.batch.name} · {dateFmt.format(a.createdAt)}</span>
                    </span>
                    <StatusBadge tone={a.stage === "ENROLLMENT_CONFIRMED" ? "ok" : "off"}>{stages[a.stage]}</StatusBadge>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
              {can(viewer.role, "students.delete") && <DeleteStudent id={user.id} email={user.email} inquiries={await inquiriesFromEmail(user.email)} />}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
