import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { pkDay } from "@/lib/pk-time";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { assignableStaff, getInquiry } from "@/modules/inquiries/admin";
import { serviceLabel, statusLabels } from "@/modules/inquiries/labels";
import { DeleteLead, LeadUpdateForm, NoteForm } from "../LeadForms";

export const metadata: Metadata = { title: "Inquiry" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function InquiryPage({ params }: PageProps<"/[lang]/admin/inquiries/[id]">) {
  const user = await requirePagePermission("inquiries.manage", "/admin/inquiries");
  const { id } = await params;
  const [inquiry, staff] = await Promise.all([getInquiry(id), assignableStaff()]);
  if (!inquiry) notFound();

  const details: [string, string | null][] = [
    ["Received", dateFmt.format(inquiry.createdAt)],
    ["Service", serviceLabel(inquiry.service)],
    ["Company", inquiry.company],
    ["Sent from page", inquiry.source],
    ["Website language", inquiry.locale === "ur" ? "Urdu" : inquiry.locale === "en" ? "English" : null],
    ["Campaign", [inquiry.utmSource, inquiry.utmMedium, inquiry.utmCampaign].filter(Boolean).join(" / ") || null],
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/inquiries" className="text-sm text-muted hover:text-charcoal-900">← All inquiries</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">{inquiry.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            <a href={`mailto:${inquiry.email}`} className="underline underline-offset-4" dir="ltr">{inquiry.email}</a>
            {inquiry.phone && <a href={`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-4" dir="ltr">{inquiry.phone}</a>}
          </p>
        </div>
        <StatusBadge tone={inquiry.status === "QUALIFIED" ? "ok" : inquiry.status === "NEW" ? "warn" : "off"}>{statusLabels[inquiry.status]}</StatusBadge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="msg" className="glass rounded-2xl p-6">
            <h2 id="msg" className="font-semibold text-charcoal-900">Message</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-charcoal-800" dir="auto">{inquiry.message}</p>
            <dl className="mt-6 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-charcoal-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="notes" className="glass rounded-2xl p-6">
            <h2 id="notes" className="font-semibold text-charcoal-900">Notes ({inquiry.notes.length})</h2>
            <ol className="mt-4 space-y-4">
              {inquiry.notes.map((n) => (
                <li key={n.id} className="glass-subtle rounded-xl p-4 text-sm">
                  <p className="whitespace-pre-wrap break-words text-charcoal-900" dir="auto">{n.body}</p>
                  <p className="mt-2 text-xs text-muted">{n.author?.name ?? "Former team member"} · {dateFmt.format(n.createdAt)}</p>
                </li>
              ))}
              {inquiry.notes.length === 0 && <li className="text-sm text-muted">No notes yet.</li>}
            </ol>
            <div className="mt-4"><NoteForm id={inquiry.id} /></div>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="manage" className="glass rounded-2xl p-6">
            <h2 id="manage" className="font-semibold text-charcoal-900">Manage</h2>
            <div className="mt-4">
              <LeadUpdateForm
                id={inquiry.id}
                status={inquiry.status}
                assignedToId={inquiry.assignedToId}
                followUpDay={inquiry.followUpAt ? pkDay(inquiry.followUpAt) : null}
                staff={staff}
              />
            </div>
          </section>
          {can(user.role, "inquiries.delete") && <DeleteLead id={inquiry.id} />}
        </aside>
      </div>
    </div>
  );
}
