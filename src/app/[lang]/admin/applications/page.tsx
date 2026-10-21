import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { getDictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { listApplications, parseApplicationFilter, type ApplicationTab } from "@/modules/admissions/service";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { formatPkr } from "@/modules/payments/service";

export const metadata: Metadata = { title: "Applications" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

const TABS: { tab: ApplicationTab; label: string }[] = [
  { tab: "PAYMENT_SUBMITTED", label: "Payment to verify" },
  { tab: "PAYMENT_PENDING", label: "Waiting for payment" },
  { tab: "APPLICATION_RECEIVED", label: "Email not confirmed" },
  { tab: "ENROLLMENT_CONFIRMED", label: "Enrolled" },
  { tab: "CLOSED", label: "Rejected / cancelled" },
  { tab: "ALL", label: "All" },
];

export default async function ApplicationsPage({ searchParams }: PageProps<"/[lang]/admin/applications">) {
  const user = await requirePagePermission("applications.view", "/admin/applications");
  const filter = parseApplicationFilter(await searchParams);
  const [{ items, byStage }, batches] = await Promise.all([
    listApplications(filter, user),
    db().batch.findMany({ orderBy: { startDate: "desc" }, take: 100, select: { id: true, name: true, code: true } }),
  ]);
  const stages = getDictionary("en").apply.stages;
  const count = (tab: ApplicationTab) =>
    tab === "ALL"
      ? Object.values(byStage).reduce((a, b) => a + (b ?? 0), 0)
      : tab === "CLOSED"
        ? (byStage.REJECTED ?? 0) + (byStage.CANCELLED ?? 0) + (byStage.WITHDRAWN ?? 0)
        : tab === "ENROLLMENT_CONFIRMED"
          ? null
          : (byStage[tab] ?? 0);
  const href = (over: Partial<{ tab: string; batch: string; q: string }>) => {
    const p = new URLSearchParams();
    const v = { tab: filter.tab, batch: filter.batchId ?? "", q: filter.q ?? "", ...over };
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    return `/admin/applications?${p}`;
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Applications</h1>
        <p className="mt-1 text-muted">
          Visitors apply for a batch, confirm their email and send their payment details. A Super Admin verifies the payment against the account statement, which
          reserves the seat and creates the student account.
        </p>
        </div>
        {can(user.role, "students.export") && (
          <a href={`/api/admin/applications/export?${new URLSearchParams({ tab: filter.tab, ...(filter.batchId && { batch: filter.batchId }), ...(filter.q && { q: filter.q }) })}`} className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-white/90">
            Export CSV
          </a>
        )}
      </div>

      <nav aria-label="Stage" className="flex flex-wrap gap-2 text-sm">
        {TABS.map(({ tab, label }) => {
          const n = count(tab);
          return (
            <Link
              key={tab}
              href={href({ tab })}
              aria-current={filter.tab === tab ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 font-medium ${filter.tab === tab ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800 hover:bg-white/80"}`}
            >
              {label}
              {n !== null && ` (${n})`}
            </Link>
          );
        })}
      </nav>

      <form className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4" action="/admin/applications">
        <input type="hidden" name="tab" value={filter.tab} />
        <label className="text-sm">
          <span className="block font-medium text-charcoal-900">Batch</span>
          <select name="batch" defaultValue={filter.batchId ?? ""} className="mt-1 rounded-xl border border-charcoal-200 bg-white/80 px-3 py-2">
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </select>
        </label>
        <label className="min-w-56 flex-1 text-sm">
          <span className="block font-medium text-charcoal-900">Search</span>
          <input name="q" defaultValue={filter.q ?? ""} placeholder="Name, email, phone or reference" className="mt-1 w-full rounded-xl border border-charcoal-200 bg-white/80 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-semibold text-white">Filter</button>
      </form>

      {items.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-6 text-muted">Nothing here.</p>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Applicant</th>
                <th scope="col" className="px-4 py-3">Program / batch</th>
                <th scope="col" className="px-4 py-3">Fee</th>
                <th scope="col" className="px-4 py-3">Stage</th>
                <th scope="col" className="px-4 py-3">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-200/50">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/applications/${a.id}`} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline" dir="auto">{a.name}</Link>
                    <span className="block text-xs text-muted" dir="ltr">{a.reference} · {a.email}</span>
                    <span className="block text-xs text-muted" dir="ltr">{a.phone} · {a.city}</span>
                  </td>
                  <td className="px-4 py-3"><span dir="auto">{a.course.title}</span><span className="block text-xs text-muted">{a.batch.name}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap" dir="ltr">{formatPkr(a.feeAmount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={a.stage === "PAYMENT_SUBMITTED" ? "warn" : a.enrollmentId ? "ok" : "off"}>{stages[a.stage]}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateFmt.format(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
