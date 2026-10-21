import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyField, StatusBadge } from "@/components/admin/ui";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { formatPkr, getPayment } from "@/modules/payments/service";
import { methodLabels, statusLabels, statusTone } from "../labels";
import { PaymentDecision } from "../PaymentForms";

export const metadata: Metadata = { title: "Payment" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export default async function PaymentPage({ params }: PageProps<"/[lang]/admin/payments/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("payments.view", `/admin/payments/${id}`);
  const p = await getPayment(id);
  if (!p) notFound();
  const receiptUrl = `/api/payments/${p.id}/receipt`;
  const currentPrice = p.course.accessType === "PAID" ? p.course.priceAmount : null;
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-3 gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 text-charcoal-900">{value}</dd>
    </div>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-charcoal-900">← All payments</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-charcoal-900">Payment of <span dir="ltr">{formatPkr(p.amount)}</span></h1>
        <StatusBadge tone={statusTone[p.status]}>{statusLabels[p.status]}</StatusBadge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="pay-details" className="glass rounded-2xl p-6">
          <h2 id="pay-details" className="text-lg font-semibold text-charcoal-900">Details</h2>
          <dl className="mt-3 divide-y divide-charcoal-200/50 text-sm">
            {row("Student", <><span dir="auto">{p.user.name}</span><span className="block text-muted" dir="ltr">{p.user.email}</span></>)}
            {row("Course", <Link href={`/admin/courses/${p.course.id}`} className="underline underline-offset-4" dir="auto">{p.course.title}</Link>)}
            {row("Amount due", <><span dir="ltr">{formatPkr(p.amount)}</span>{currentPrice && currentPrice !== p.amount && <span className="block text-xs text-muted">Current price: {formatPkr(currentPrice)}</span>}</>)}
            {row("Method", methodLabels[p.method])}
            {row("Transaction ID", <span className="font-mono" dir="ltr">{p.reference}</span>)}
            {p.payerName && row("Paid from", <span dir="auto">{p.payerName}</span>)}
            {p.paidOn && row("Paid on", dayFmt.format(p.paidOn))}
            {row("Sent", dateFmt.format(p.createdAt))}
            {p.note && row("Message", <span className="whitespace-pre-line" dir="auto">{p.note}</span>)}
            {p.decidedAt && row(p.status === "CONFIRMED" ? "Confirmed" : "Rejected", `${dateFmt.format(p.decidedAt)}${p.decidedBy ? ` by ${p.decidedBy.name}` : ""}`)}
            {p.decisionNote && row("Reason given", <span dir="auto">{p.decisionNote}</span>)}
          </dl>
          <div className="mt-4">
            <CopyField label="Google email (share course videos with)" value={p.user.googleEmail ?? p.user.email} />
          </div>
        </section>

        <section aria-labelledby="receipt" className="glass space-y-4 rounded-2xl p-6">
          <h2 id="receipt" className="text-lg font-semibold text-charcoal-900">Receipt</h2>
          {p.receiptMime?.startsWith("image/") ? (
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptUrl} alt={`Receipt sent by ${p.user.name}`} className="max-h-[32rem] w-full rounded-xl bg-white object-contain ring-1 ring-white" />
            </a>
          ) : p.receiptKey ? (
            <a href={receiptUrl} className="inline-block rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-semibold text-white">Download receipt (PDF)</a>
          ) : (
            <p className="text-muted">No receipt attached.</p>
          )}
          {p.status === "PENDING" &&
            (can(user.role, "payments.manage") ? (
              <div className="border-t border-charcoal-200/50 pt-4">
                <p className="mb-3 text-sm text-muted">Check your bank or wallet for this amount and transaction ID. Share the course videos with the Google email, then confirm.</p>
                <PaymentDecision id={p.id} />
              </div>
            ) : (
              <p className="text-sm text-muted">Waiting for a Super Admin to confirm.</p>
            ))}
        </section>
      </div>
    </div>
  );
}
