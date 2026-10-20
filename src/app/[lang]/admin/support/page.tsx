import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { listTickets, parseTicketFilter } from "@/modules/support/service";

export const metadata: Metadata = { title: "Support" };

const PAGE_SIZE = 25;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
const statusText = { OPEN: "Open", AWAITING_STUDENT: "Waiting for student", RESOLVED: "Resolved", CLOSED: "Closed" } as const;
const tabs = [
  { value: "ACTIVE", label: "Active" },
  { value: "OPEN", label: "Needs reply" },
  { value: "AWAITING_STUDENT", label: "Waiting for student" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "ALL", label: "All" },
];

export default async function SupportAdminPage({ searchParams }: PageProps<"/[lang]/admin/support">) {
  const user = await requirePagePermission("admin.access", "/admin/support");
  if (!can(user.role, "support.manage.all") && !can(user.role, "support.manage.own")) notFound();
  const sp = await searchParams;
  const f = parseTicketFilter(sp);
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const { items, total, open } = await listTickets(user, f, page, PAGE_SIZE);
  const current = sp.status === "ALL" ? "ALL" : (f.status ?? "ACTIVE");
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: current, q: f.q, ...over })) if (v) p.set(k, v);
    return `/admin/support?${p}`;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Support</h1>
        <p className="mt-1 text-muted">
          {open} {open === 1 ? "request needs" : "requests need"} a reply.{" "}
          {can(user.role, "support.manage.all") ? "All support requests." : "Requests about your courses."}
        </p>
      </div>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link key={t.value} href={href({ status: t.value, page: undefined })} aria-current={current === t.value ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${current === t.value ? "bg-charcoal-900 text-white" : "glass-subtle text-charcoal-800 hover:bg-white/80"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="status" value={current} />
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-charcoal-900">Search</label>
          <input id="q" name="q" defaultValue={f.q} placeholder="Subject, name or email" className={`${inputClass} w-64`} />
        </div>
        <button type="submit" className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white">Search</button>
      </form>
      {items.length === 0 ? (
        <p className="glass-subtle rounded-2xl p-8 text-center text-muted">No support requests here.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/support/${t.id}`} className="glass glow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
                <span className="min-w-0">
                  <span className="block font-semibold text-charcoal-900" dir="auto">{t.subject}</span>
                  <span className="text-xs text-muted">
                    {t.user.name} · {t.course?.title ?? "General"} · last message {dateFmt.format(t.messages[0]?.createdAt ?? t.updatedAt)}
                  </span>
                </span>
                <StatusBadge tone={t.status === "OPEN" ? "warn" : t.status === "RESOLVED" ? "ok" : "off"}>{statusText[t.status]}</StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={href({ page: String(page - 1) })} className="underline">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={href({ page: String(page + 1) })} className="underline">Next</Link>}
        </nav>
      )}
    </div>
  );
}
