import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { db } from "@/lib/db";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { formatPkr, listPayments, parsePaymentFilter } from "@/modules/payments/service";
import { methodLabels, statusTone, statusLabels } from "./labels";

export const metadata: Metadata = { title: "Payments" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function PaymentsPage({ searchParams }: PageProps<"/[lang]/admin/payments">) {
  const user = await requirePagePermission("payments.view", "/admin/payments");
  const sp = await searchParams;
  const filter = parsePaymentFilter(sp);
  const [items, counts] = await Promise.all([listPayments(filter), db().payment.groupBy({ by: ["status"], _count: { _all: true } })]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const tabs = [
    { value: "PENDING", label: `Waiting (${count("PENDING")})` },
    { value: "CONFIRMED", label: `Confirmed (${count("CONFIRMED")})` },
    { value: "REJECTED", label: `Rejected (${count("REJECTED")})` },
    { value: "ALL", label: "All" },
  ];
  const current = filter.status ?? "ALL";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Payments</h1>
          <p className="mt-1 text-muted">
            Students pay for paid courses by bank transfer, JazzCash or EasyPaisa and send the transaction ID with a receipt. Check the money arrived in your
            account, then confirm to open the course.{!can(user.role, "payments.manage") && " Only a Super Admin can confirm or reject payments."}
          </p>
        </div>
        {can(user.role, "payments.manage") && (
          <Link href="/admin/payments/settings" className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-white/90">
            Payment details
          </Link>
        )}
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/admin/payments?status=${t.value}${filter.q ? `&q=${encodeURIComponent(filter.q)}` : ""}`}
            aria-current={current === t.value ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${current === t.value ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800 hover:bg-white/80"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="status" value={current} />
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-charcoal-900">Search</label>
          <input id="q" name="q" defaultValue={filter.q} placeholder="Student name or email" className={`${inputClass} w-64`} />
        </div>
        <button type="submit" className="rounded-lg bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white">Apply</button>
      </form>

      {items.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-8 text-center text-muted">
          {current === "PENDING" ? "No payments waiting. New ones appear here and are emailed to Super Admins." : "Nothing here yet."}
        </p>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-start text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-start">Sent</th>
                <th scope="col" className="px-4 py-3 text-start">Student</th>
                <th scope="col" className="px-4 py-3 text-start">Course</th>
                <th scope="col" className="px-4 py-3 text-start">Amount</th>
                <th scope="col" className="px-4 py-3 text-start">Method / reference</th>
                <th scope="col" className="px-4 py-3 text-start">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-200/50">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-white/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/admin/payments/${p.id}`} className="font-medium text-charcoal-900 underline underline-offset-4">{dateFmt.format(p.createdAt)}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium text-charcoal-900" dir="auto">{p.user.name}</span>
                    <span className="block text-muted" dir="ltr">{p.user.email}</span>
                  </td>
                  <td className="px-4 py-3" dir="auto">{p.course.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold" dir="ltr">{formatPkr(p.amount)}</td>
                  <td className="px-4 py-3">
                    {methodLabels[p.method]}
                    <span className="block font-mono text-xs text-muted" dir="ltr">{p.reference}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone={statusTone[p.status]}>{statusLabels[p.status]}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
