import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice, StatusBadge } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { availabilityLabels, batchStatusLabels } from "@/modules/batches/labels";
import { formatDay, isoDay } from "@/modules/batches/rules";
import { coordinatorOptions, getBatch } from "@/modules/batches/service";
import { getDictionary } from "@/i18n/get-dictionary";
import { allowedStages, roster } from "@/modules/enrollments/service";
import { BatchForm } from "../BatchForm";
import { StaffStep, StageControl, TransferControl } from "../RosterControls";

export const metadata: Metadata = { title: "Batch" };

export default async function BatchPage({ params, searchParams }: PageProps<"/[lang]/admin/batches/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/batches/${id}`);
  const batch = await getBatch(id, user);
  if (!batch) notFound();
  const sp = await searchParams;
  const manage = can(user.role, "batches.manage");
  const stages = getDictionary("en").apply.stages;
  const [students, transferTargets] = await Promise.all([
    roster(batch.id, user),
    can(user.role, "enrollments.admin")
      ? db().batch.findMany({ where: { courseId: batch.courseId, id: { not: batch.id }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, orderBy: { startDate: "asc" }, select: { id: true, name: true, code: true } })
      : [],
  ]);
  const canWithdraw = can(user.role, "enrollments.admin");
  const [programs, coordinators] = manage
    ? await Promise.all([
        db().course.findMany({ where: { OR: [{ status: { in: ["PUBLISHED", "DRAFT"] } }, { id: batch.courseId }] }, orderBy: { title: "asc" }, select: { id: true, title: true, accessType: true, priceAmount: true } }),
        coordinatorOptions(),
      ])
    : [[], []];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/batches" className="text-sm text-muted hover:text-charcoal-900">← Batches</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-charcoal-900">{batch.name}</h1>
          <StatusBadge tone={batch.open === "open" ? "ok" : "warn"}>{batchStatusLabels[batch.status]}{batch.status === "OPEN" ? ` · ${availabilityLabels[batch.open]}` : ""}</StatusBadge>
        </div>
        <p className="mt-1 text-muted">
          <span dir="ltr">{batch.code}</span> · {batch.course.title} · starts {formatDay(batch.startDate)} · {batch.taken} of {batch.capacity} seats taken
        </p>
      </div>
      {sp.created && <Notice tone="success">Batch created. Set the status to “Open for applications” when you&apos;re ready to show it on the program page.</Notice>}

      <section aria-labelledby="students" className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="students" className="text-lg font-semibold text-charcoal-900">Students ({students?.length ?? 0})</h2>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href={`/admin/live-classes?batch=${batch.id}`} className="underline underline-offset-4">Schedule</Link>
            <Link href={`/admin/announcements?batch=${batch.id}`} className="underline underline-offset-4">Send a notice</Link>
            {can(user.role, "applications.view") && <Link href={`/admin/applications?tab=ALL&batch=${batch.id}`} className="underline underline-offset-4">Applications</Link>}
            {can(user.role, "students.export") && <a href={`/api/admin/batches/${batch.id}/export`} className="underline underline-offset-4">Export CSV</a>}
          </div>
        </div>
        {!students?.length ? (
          <p className="mt-2 text-sm text-muted">No students yet. Students appear here when a Super Admin verifies their payment.</p>
        ) : (
          <ul className="mt-4 divide-y divide-charcoal-200/50">
            {students.map((r) => {
              const staffSteps = r.onboarding.items.filter((i) => !i.studentCompletes);
              const options = allowedStages(r.stage).filter((s) => canWithdraw || (s !== "WITHDRAWN" && r.stage !== "WITHDRAWN")).map((s) => ({ value: s, label: stages[s] }));
              return (
                <li key={r.id} className="space-y-2 py-4" aria-label={r.user.name}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {can(user.role, "students.view") ? (
                        <Link href={`/admin/students/${r.user.id}`} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline" dir="auto">{r.user.name}</Link>
                      ) : (
                        <span className="font-semibold text-charcoal-900" dir="auto">{r.user.name}</span>
                      )}
                      <p className="text-xs text-muted" dir="ltr">{r.user.email} · {r.user.phone ?? "-"} · {r.user.city ?? "-"}</p>
                      {r.onboarding.requiredTotal > 0 && <p className="text-xs text-muted">Onboarding: {r.onboarding.requiredDone} of {r.onboarding.requiredTotal} required steps</p>}
                    </div>
                    <StatusBadge tone={r.stage === "ACTIVE" || r.stage === "COMPLETED" ? "ok" : r.stage === "WITHDRAWN" ? "off" : "warn"}>{r.stage ? stages[r.stage] : r.status}</StatusBadge>
                  </div>
                  {staffSteps.length > 0 && (
                    <div className="flex flex-wrap gap-4">
                      {staffSteps.map((i) => <StaffStep key={i.id} enrollmentId={r.id} itemId={i.id} title={i.title} done={!!i.completedAt} />)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4">
                    <StageControl enrollmentId={r.id} options={options} />
                    {r.stage !== "WITHDRAWN" && r.stage !== "COMPLETED" && (
                      <TransferControl enrollmentId={r.id} batches={transferTargets.map((b) => ({ id: b.id, label: `${b.name} (${b.code})` }))} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {manage ? (
        <section aria-labelledby="details" className="glass rounded-2xl p-6">
          <h2 id="details" className="mb-4 text-lg font-semibold text-charcoal-900">Details</h2>
          <BatchForm
            id={batch.id}
            programs={programs.map((p) => ({ id: p.id, title: p.title, paid: p.accessType === "PAID" && !!p.priceAmount }))}
            coordinators={coordinators}
            value={{
              courseId: batch.courseId,
              name: batch.name,
              code: batch.code,
              status: batch.status,
              startDate: isoDay(batch.startDate),
              endDate: batch.endDate ? isoDay(batch.endDate) : "",
              applicationDeadline: batch.applicationDeadline ? isoDay(batch.applicationDeadline) : "",
              scheduleText: batch.scheduleText,
              capacity: String(batch.capacity),
              meetingUrl: batch.meetingUrl ?? "",
              joiningInfo: batch.joiningInfo ?? "",
              internalNotes: batch.internalNotes ?? "",
              coordinatorId: batch.coordinatorId ?? "",
            }}
          />
        </section>
      ) : (
        <section aria-labelledby="details" className="glass rounded-2xl p-6 text-sm">
          <h2 id="details" className="mb-3 text-lg font-semibold text-charcoal-900">Details</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-muted">Class times</dt><dd className="text-charcoal-900">{batch.scheduleText}</dd></div>
            <div><dt className="text-muted">Dates</dt><dd className="text-charcoal-900">{formatDay(batch.startDate)}{batch.endDate && ` – ${formatDay(batch.endDate)}`}</dd></div>
            {batch.meetingUrl && <div className="sm:col-span-2"><dt className="text-muted">Meeting link</dt><dd dir="ltr" className="truncate">{batch.meetingUrl}</dd></div>}
          </dl>
        </section>
      )}
    </div>
  );
}
