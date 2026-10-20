import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { serviceSlugs } from "@/content/services";
import { pkTodayRange } from "@/lib/pk-time";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { assignableStaff, listInquiries, parseFilters } from "@/modules/inquiries/admin";
import { getLeadAlertSetting } from "@/modules/inquiries/alerts";
import { serviceLabel, statusLabels } from "@/modules/inquiries/labels";
import { getSmtpStatus } from "@/modules/settings/integrations";
import { AlertSettingForm } from "./LeadForms";

export const metadata: Metadata = { title: "Inquiries" };

const PAGE_SIZE = 25;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });
const tone = { NEW: "warn", CONTACTED: "off", QUALIFIED: "ok", CLOSED: "off", SPAM: "off" } as const;

export default async function InquiriesPage({ searchParams }: PageProps<"/[lang]/admin/inquiries">) {
  const user = await requirePagePermission("inquiries.manage", "/admin/inquiries");
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const [{ items, total }, staff, alerts, smtp] = await Promise.all([
    listInquiries(filters, user, page, PAGE_SIZE),
    assignableStaff(),
    getLeadAlertSetting(),
    getSmtpStatus(),
  ]);
  const { start } = pkTodayRange();
  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...extra } as Record<string, string>).toString();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Inquiries</h1>
          <p className="mt-1 text-muted">Leads from the website contact forms. Spam is hidden unless you filter for it.</p>
        </div>
        {can(user.role, "inquiries.export") && (
          <a href={`/api/admin/inquiries/export?${qs({})}`} className="rounded-xl border border-white/80 bg-white/60 shadow-sm px-4 py-2.5 text-sm font-semibold hover:bg-white/90">
            Export CSV{filtered ? " (filtered)" : ""}
          </a>
        )}
      </div>

      {can(user.role, "settings.manage") && <AlertSettingForm enabled={alerts.enabled} email={alerts.email} smtpReady={!!smtp.verifiedAt} />}

      <form role="search" className="grid gap-3 glass rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="block text-sm font-medium">Search</label>
          <input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Name, email, company or message" className={inputClass} />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium">Status</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""} className={inputClass}>
            <option value="">Any (except spam)</option>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="service" className="block text-sm font-medium">Service</label>
          <select id="service" name="service" defaultValue={filters.service ?? ""} className={inputClass}>
            <option value="">Any</option>
            {[...serviceSlugs, "general"].map((s) => <option key={s} value={s}>{serviceLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="assignee" className="block text-sm font-medium">Assigned to</label>
          <select id="assignee" name="assignee" defaultValue={filters.assignee ?? ""} className={inputClass}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="none">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="followUp" className="block text-sm font-medium">Follow-up</label>
          <select id="followUp" name="followUp" defaultValue={filters.followUp ?? ""} className={inputClass}>
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
        <div className="flex items-end gap-3 lg:col-span-6">
          <button type="submit" className="rounded-lg bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-charcoal-800">Apply filters</button>
          {filtered && <Link href="/admin/inquiries" className="text-sm underline underline-offset-4">Clear</Link>}
          <p className="ms-auto text-sm text-muted">{total} inquir{total === 1 ? "y" : "ies"}</p>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-muted">{filtered ? "No inquiries match these filters." : "No inquiries yet. They will appear here when visitors use the contact form."}</p>
      ) : (
        <div className="overflow-x-auto glass rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-white/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-start">Received</th>
                <th scope="col" className="px-4 py-3 text-start">From</th>
                <th scope="col" className="px-4 py-3 text-start">Service</th>
                <th scope="col" className="px-4 py-3 text-start">Status</th>
                <th scope="col" className="px-4 py-3 text-start">Assigned</th>
                <th scope="col" className="px-4 py-3 text-start">Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => {
                const overdue = i.followUpAt && i.followUpAt < start && ["NEW", "CONTACTED", "QUALIFIED"].includes(i.status);
                return (
                  <tr key={i.id} className="align-top hover:bg-white/50">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{dateFmt.format(i.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/inquiries/${i.id}`} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">{i.name}</Link>
                      <span className="block text-muted" dir="ltr">{i.email}</span>
                      {i.company && <span className="block text-xs text-muted">{i.company}</span>}
                    </td>
                    <td className="px-4 py-3">{serviceLabel(i.service)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={tone[i.status]}>{statusLabels[i.status]}</StatusBadge></td>
                    <td className="px-4 py-3">{i.assignedTo?.name ?? <span className="text-muted">-</span>}</td>
                    <td className={`whitespace-nowrap px-4 py-3 ${overdue ? "font-semibold text-red-700" : ""}`}>
                      {i.followUpAt ? `${dayFmt.format(i.followUpAt)}${overdue ? " (overdue)" : ""}` : <span className="text-muted">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/admin/inquiries?${qs({ page: String(page - 1) })}`} className="underline underline-offset-4">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/admin/inquiries?${qs({ page: String(page + 1) })}`} className="underline underline-offset-4">Next</Link>}
        </nav>
      )}
    </div>
  );
}
