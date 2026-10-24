import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/admin/ui";
import { getDictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { OPEN_APPLICATION_STAGES } from "@/modules/admissions/rules";
import { getApplication } from "@/modules/admissions/service";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { formatDay } from "@/modules/batches/rules";
import { formatPkr } from "@/modules/payments/service";
import { methodLabels, statusLabels, statusTone } from "../../payments/labels";
import { CloseApplication, MoveApplication, PaymentDecision, ResendLink } from "../ApplicationForms";
import { formatMoney } from "@/modules/currency/rules";

export const metadata: Metadata = { title: "Application" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export default async function ApplicationPage({ params }: PageProps<"/[lang]/admin/applications/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("applications.view", `/admin/applications/${id}`);
  const app = await getApplication(id, user);
  if (!app) notFound();
  const stages = getDictionary("en").apply.stages;
  const open = (OPEN_APPLICATION_STAGES as readonly string[]).includes(app.stage);
  const superAdmin = can(user.role, "payments.manage");
  const otherBatches =
    open && can(user.role, "enrollments.admin")
      ? await db().batch.findMany({ where: { courseId: app.courseId, status: { notIn: ["COMPLETED", "CANCELLED"] } }, orderBy: { startDate: "asc" }, select: { id: true, name: true, code: true, startDate: true } })
      : [];
  const row = (label: string, value: ReactNode) => (
    <div className="grid grid-cols-3 gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2 text-charcoal-900">{value}</dd>
    </div>
  );

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/admin/applications" className="text-sm text-muted hover:text-charcoal-900">← Applications</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-charcoal-900" dir="auto">{app.name}</h1>
        <StatusBadge tone={app.stage === "PAYMENT_SUBMITTED" ? "warn" : app.enrollmentId ? "ok" : "off"}>{stages[app.stage]}</StatusBadge>
      </div>
      <p className="-mt-4 font-mono text-sm text-muted" dir="ltr">{app.reference}</p>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section aria-labelledby="applicant" className="glass rounded-2xl p-6">
            <h2 id="applicant" className="text-lg font-semibold text-charcoal-900">Applicant</h2>
            <dl className="mt-3 divide-y divide-charcoal-200/50 text-sm">
              {row("Email", <span dir="ltr">{app.email}{app.emailConfirmedAt ? " · confirmed" : " · not confirmed yet"}</span>)}
              {row("Phone / WhatsApp", <span dir="ltr">{app.phone}</span>)}
              {row("City", app.city)}
              {row("CNIC", app.cnic ? <span className="font-mono" dir="ltr">{app.cnic}</span> : <span className="text-muted">Visible to Super Admins only</span>)}
              {row("CV", app.cvKey ? <a href={`/api/applications/${app.id}/cv`} className="font-semibold underline underline-offset-4">Download CV</a> : <span className="text-muted">{app.cnic === null ? "Visible to Super Admins only" : "Not attached"}</span>)}
              {app.message && row("Message", <span className="whitespace-pre-line" dir="auto">{app.message}</span>)}
              {row("Program", <Link href={`/admin/courses/${app.course.id}`} className="underline underline-offset-4" dir="auto">{app.course.title}</Link>)}
              {row("Batch", <><Link href={`/admin/batches/${app.batch.id}`} className="underline underline-offset-4">{app.batch.name}</Link><span className="block text-xs text-muted">starts {formatDay(app.batch.startDate)}</span></>)}
              {row("Fee", <span dir="ltr">{formatPkr(app.feeAmount)}</span>)}
              {app.displayCurrency && app.displayAmount !== null && row("Shown to the applicant", <span dir="ltr">≈ {formatMoney(app.displayAmount, app.displayCurrency)} (rate {app.displayRate?.toString()} per PKR{app.displayRateAt ? `, ${dayFmt.format(app.displayRateAt)}` : ""}{app.displayProvider ? `, ${app.displayProvider}` : ""}) · estimate only, the PKR fee is due</span>)}
              {row("Applied", dateFmt.format(app.createdAt))}
              {app.user && row("Student account", <Link href={`/admin/students/${app.user.id}`} className="underline underline-offset-4">{app.user.name}{app.user.status === "SUSPENDED" ? " (suspended)" : ""}</Link>)}
              {app.decisionNote && row("Note", <span dir="auto">{app.decisionNote}</span>)}
            </dl>
          </section>

          <section aria-labelledby="payments" className="space-y-4">
            <h2 id="payments" className="text-lg font-semibold text-charcoal-900">Payments ({app.payments.length})</h2>
            {app.payments.length === 0 && <p className="glass-subtle rounded-2xl p-5 text-sm text-muted">No payment details sent yet.</p>}
            {app.payments.map((p) => {
              const receiptUrl = `/api/payments/${p.id}/receipt`;
              return (
                <article key={p.id} className="glass space-y-4 rounded-2xl p-6" aria-label={`Payment ${p.reference}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-charcoal-900">{methodLabels[p.method]} · <span className="font-mono" dir="ltr">{p.reference}</span></p>
                    <StatusBadge tone={statusTone[p.status]}>{p.status === "CONFIRMED" ? "Verified" : statusLabels[p.status]}</StatusBadge>
                  </div>
                  <dl className="divide-y divide-charcoal-200/50 text-sm">
                    {row("Amount due", <span dir="ltr">{formatPkr(p.amount)}</span>)}
                    {p.amountReceived !== null && row("Amount received", <span dir="ltr">{formatPkr(p.amountReceived)}</span>)}
                    {p.payerName && row("Paid from", <span dir="auto">{p.payerName}</span>)}
                    {p.sentAmount !== null && p.sentCurrency && row("Sent from abroad (as stated)", <span dir="ltr">{formatMoney(p.sentAmount, p.sentCurrency)} · check the PKR that arrived</span>)}
                    {p.paidOn && row("Paid on", dayFmt.format(p.paidOn))}
                    {row("Sent", dateFmt.format(p.createdAt))}
                    {p.note && row("Message", <span className="whitespace-pre-line" dir="auto">{p.note}</span>)}
                    {p.decidedAt && row(p.status === "CONFIRMED" ? "Verified" : "Rejected", `${dateFmt.format(p.decidedAt)}${p.decidedBy ? ` by ${p.decidedBy.name}` : ""}`)}
                    {p.decisionNote && row("Reason given", <span dir="auto">{p.decisionNote}</span>)}
                  </dl>
                  {p.receiptMime?.startsWith("image/") ? (
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={receiptUrl} alt={`Receipt for ${p.reference}`} className="max-h-[28rem] w-full rounded-xl bg-white object-contain ring-1 ring-white" />
                    </a>
                  ) : p.receiptKey ? (
                    <a href={receiptUrl} className="inline-block rounded-xl bg-charcoal-900 px-4 py-2 text-sm font-semibold text-white">Download receipt (PDF)</a>
                  ) : null}
                  {p.status === "PENDING" &&
                    (superAdmin ? (
                      <div className="border-t border-charcoal-200/50 pt-4">
                        <PaymentDecision paymentId={p.id} feePkr={app.feeAmount / 100} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted">Waiting for a Super Admin to verify.</p>
                    ))}
                </article>
              );
            })}
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-2">
          <section aria-labelledby="timeline" className="glass rounded-2xl p-6">
            <h2 id="timeline" className="text-lg font-semibold text-charcoal-900">Timeline</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {app.events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium text-charcoal-900">{stages[e.stage]}</p>
                  <p className="text-xs text-muted">{dateFmt.format(e.createdAt)}{e.actor ? ` · ${e.actor.name}` : ""}</p>
                  {e.note && <p className="text-xs text-charcoal-800" dir="auto">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
          {open && (
            <section aria-labelledby="manage" className="glass space-y-5 rounded-2xl p-6">
              <h2 id="manage" className="text-lg font-semibold text-charcoal-900">Manage</h2>
              <ResendLink applicationId={app.id} />
              {otherBatches.length > 1 && (
                <MoveApplication
                  applicationId={app.id}
                  current={app.batchId}
                  batches={otherBatches.map((b) => ({ id: b.id, label: `${b.name} (${b.code}) · starts ${formatDay(b.startDate)}` }))}
                />
              )}
              {can(user.role, "enrollments.admin") && <CloseApplication applicationId={app.id} />}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
