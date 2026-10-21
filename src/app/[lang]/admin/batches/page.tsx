import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/Button";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { availabilityLabels, batchStatusLabels } from "@/modules/batches/labels";
import { formatDay } from "@/modules/batches/rules";
import { BATCH_STATUSES, listBatches } from "@/modules/batches/service";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage({ searchParams }: PageProps<"/[lang]/admin/batches">) {
  const user = await requirePagePermission("admin.access", "/admin/batches");
  if (!can(user.role, "batches.manage") && !can(user.role, "batches.coordinate")) notFound();
  const sp = await searchParams;
  const status = BATCH_STATUSES.find((s) => s === sp.status);
  const batches = await listBatches(user, { status });
  const manage = can(user.role, "batches.manage");

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Batches</h1>
          <p className="mt-1 text-muted">
            {manage
              ? "Each program runs in batches with their own dates, class times and seats. Open batches appear on the program page and take applications."
              : "The batches you coordinate."}
          </p>
        </div>
        {manage && <LinkButton href="/admin/batches/new" variant="dark">New batch</LinkButton>}
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2 text-sm">
        {[undefined, ...BATCH_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/batches?status=${s}` : "/admin/batches"}
            aria-current={status === s ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 font-medium ${status === s ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800 hover:bg-white/80"}`}
          >
            {s ? batchStatusLabels[s] : "All"}
          </Link>
        ))}
      </nav>

      {batches.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-6 text-muted">{manage ? "No batches yet. Create one to start taking applications." : "No batches are assigned to you."}</p>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Batch</th>
                <th scope="col" className="px-4 py-3">Program</th>
                <th scope="col" className="px-4 py-3">Starts</th>
                <th scope="col" className="px-4 py-3">Seats</th>
                <th scope="col" className="px-4 py-3">Waiting</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-200/50">
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/batches/${b.id}`} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">{b.name}</Link>
                    <p className="text-xs text-muted" dir="ltr">{b.code}{b.coordinator && ` · ${b.coordinator.name}`}</p>
                  </td>
                  <td className="px-4 py-3" dir="auto">{b.course.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDay(b.startDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.taken} / {b.capacity}</td>
                  <td className="px-4 py-3">{b._count.applications}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={b.open === "open" ? "ok" : b.status === "CANCELLED" || b.status === "DRAFT" ? "off" : "warn"}>
                      {batchStatusLabels[b.status]}{b.status === "OPEN" && b.open !== "open" ? ` · ${availabilityLabels[b.open]}` : ""}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
