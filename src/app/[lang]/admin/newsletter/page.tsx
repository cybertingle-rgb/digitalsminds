import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { listSubscribers, subscriberCounts } from "@/modules/newsletter/service";
import { DeleteSubscriber } from "./DeleteSubscriber";

export const metadata: Metadata = { title: "Newsletter" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function NewsletterPage({ searchParams }: PageProps<"/[lang]/admin/newsletter">) {
  const user = await requirePagePermission("newsletter.view", "/admin/newsletter");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = sp.status === "UNSUBSCRIBED" ? "UNSUBSCRIBED" : sp.status === "ALL" ? undefined : "SUBSCRIBED";
  const [list, counts] = await Promise.all([listSubscribers({ q: q || undefined, status }), subscriberCounts()]);
  const exportAllowed = can(user.role, "newsletter.export");

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Newsletter</h1>
          <p className="mt-1 text-muted">
            {counts.subscribed} confirmed {counts.subscribed === 1 ? "subscriber" : "subscribers"} · {counts.unsubscribed} unsubscribed. People join from the
            website footer and confirm by email before they&apos;re added.
          </p>
        </div>
        {exportAllowed && (
          // A file download, not a page: a plain link is intended here.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a href="/api/admin/newsletter/export" className="rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-sm font-semibold text-charcoal-900 shadow-sm hover:bg-white/90">
            Export CSV
          </a>
        )}
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-charcoal-900">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Email" className={`${inputClass} w-64`} />
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-charcoal-900">Show</label>
          <select id="status" name="status" defaultValue={sp.status === "ALL" ? "ALL" : (status ?? "SUBSCRIBED")} className={inputClass}>
            <option value="SUBSCRIBED">Subscribed</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <button type="submit" className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white">Apply</button>
        {(q || sp.status) && <Link href="/admin/newsletter" className="py-2.5 text-sm text-muted underline">Clear</Link>}
      </form>
      {list.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-8 text-center text-muted">No subscribers here yet.</p>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-white/70 bg-white/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Language</th>
                <th scope="col" className="px-4 py-3">Joined from</th>
                <th scope="col" className="px-4 py-3">Confirmed</th>
                {exportAllowed && <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-200/50">
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3" dir="ltr">{s.email}</td>
                  <td className="px-4 py-3"><StatusBadge tone={s.status === "SUBSCRIBED" ? "ok" : "off"}>{s.status === "SUBSCRIBED" ? "Subscribed" : "Unsubscribed"}</StatusBadge></td>
                  <td className="px-4 py-3">{s.locale === "ur" ? "Urdu" : "English"}</td>
                  <td className="px-4 py-3 text-muted" dir="ltr">{s.source ?? "-"}</td>
                  <td className="px-4 py-3 text-muted">{dateFmt.format(s.consentAt)}</td>
                  {exportAllowed && <td className="px-4 py-3 text-end"><DeleteSubscriber id={s.id} email={s.email} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
