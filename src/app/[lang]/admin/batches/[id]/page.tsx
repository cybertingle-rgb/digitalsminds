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
import { BatchForm } from "../BatchForm";

export const metadata: Metadata = { title: "Batch" };

export default async function BatchPage({ params, searchParams }: PageProps<"/[lang]/admin/batches/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/batches/${id}`);
  const batch = await getBatch(id, user);
  if (!batch) notFound();
  const sp = await searchParams;
  const manage = can(user.role, "batches.manage");
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
