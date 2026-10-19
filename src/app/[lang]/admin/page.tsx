import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarList } from "@/components/admin/BarList";
import { StatusBadge } from "@/components/admin/ui";
import { describeAction } from "@/modules/audit/labels";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { dashboardStats } from "@/modules/dashboard/stats";
import { serviceLabel, statusLabels } from "@/modules/inquiries/labels";
import { getStorageStatus } from "@/modules/media/storage-check";
import { getGoogleStatus, getSmtpStatus } from "@/modules/settings/integrations";

export const metadata: Metadata = { title: "Overview" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-charcoal-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  return (
    <li className="rounded-xl border border-line bg-white p-5">
      {href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : body}
    </li>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-charcoal-900">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminOverview() {
  const user = await requirePagePermission("admin.access", "/admin");
  const { leads, people, media, activity } = await dashboardStats(user);
  const setup = can(user.role, "integrations.manage") ? await Promise.all([getSmtpStatus(), getGoogleStatus(), getStorageStatus()]) : null;
  const todo = setup
    ? [
        !setup[0].verifiedAt && { label: "Set up email so students can verify accounts and reset passwords", href: "/admin/integrations" },
        !setup[2].uploadsEnabled && { label: "Confirm file storage to switch on uploads", href: "/admin/integrations#storage" },
        !setup[1].enabled && { label: "Optional: connect Google sign-in", href: "/admin/integrations" },
      ].filter((t): t is { label: string; href: string } => !!t)
    : [];

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Welcome, {user.name}</h1>
        <p className="mt-1 text-muted">Live figures from the website. Times are Pakistan time.</p>
      </div>

      {todo.length > 0 && (
        <section className="rounded-2xl border border-sun-400 bg-sun-50 p-5">
          <h2 className="font-semibold text-charcoal-900">Finish setting up</h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
            {todo.map((t) => (
              <li key={t.label}><Link href={t.href} className="underline underline-offset-4">{t.label}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {leads && <Stat label="New inquiries (last 7 days)" value={leads.lastWeek} href="/admin/inquiries" />}
        {leads && <Stat label="Not yet answered" value={leads.unanswered} hint="Status: New" href="/admin/inquiries?status=NEW" />}
        {leads && (
          <Stat
            label="Follow-ups due"
            value={leads.followUpsDue}
            hint="Today or overdue"
            href="/admin/inquiries?followUp=overdue"
          />
        )}
        {people && <Stat label="Student accounts" value={people.students} hint={`${people.newStudents} new in the last 7 days`} />}
        {people && can(user.role, "staff.manage") && <Stat label="Active team members" value={people.staff} href="/admin/team" />}
        {media && (
          <Stat
            label={can(user.role, "media.manage.all") ? "Files in the media library" : "Your uploaded files"}
            value={media.files}
            hint={`${(media.bytes / 1024 / 1024).toFixed(1)} MB used`}
            href="/admin/media"
          />
        )}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        {leads && (
          <Panel title="Inquiries by service (last 30 days)">
            {leads.byService.length === 0 ? (
              <p className="text-sm text-muted">No inquiries in the last 30 days.</p>
            ) : (
              <BarList label="Inquiries by service, last 30 days" items={leads.byService.map((r) => ({ label: serviceLabel(r.service), value: r.count }))} />
            )}
          </Panel>
        )}
        {leads && (
          <Panel title="Latest inquiries" action={<Link href="/admin/inquiries" className="text-sm underline underline-offset-4">View all</Link>}>
            {leads.recent.length === 0 ? (
              <p className="text-sm text-muted">No inquiries yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {leads.recent.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link href={`/admin/inquiries/${i.id}`} className="font-medium text-charcoal-900 underline-offset-4 hover:underline">{i.name}</Link>
                      <span className="block truncate text-xs text-muted">{serviceLabel(i.service)} · {dateFmt.format(i.createdAt)}</span>
                    </span>
                    <StatusBadge tone={i.status === "NEW" ? "warn" : i.status === "QUALIFIED" ? "ok" : "off"}>{statusLabels[i.status]}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        {activity && (
          <Panel title="Recent activity" action={<Link href="/admin/activity" className="text-sm underline underline-offset-4">View all</Link>}>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="py-2">
                    <span className="text-charcoal-900">{describeAction(a.action)}</span>
                    <span className="block text-xs text-muted">{a.actor?.name ?? "Former team member"} · {dateFmt.format(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
