import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { adminAnnouncements, audienceOptions } from "@/modules/announcements/service";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { AnnouncementForm, DeleteAnnouncement } from "./AnnouncementForms";

export const metadata: Metadata = { title: "Announcements" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function AnnouncementsPage({ searchParams }: PageProps<"/[lang]/admin/announcements">) {
  const user = await requirePagePermission("admin.access", "/admin/announcements");
  const site = can(user.role, "announcements.site");
  if (!site && !can(user.role, "batches.manage") && !can(user.role, "batches.coordinate")) notFound();
  const sp = await searchParams;
  const [audiences, list] = await Promise.all([audienceOptions(user), adminAnnouncements(user)]);
  const preset = typeof sp.batch === "string" ? `batch:${sp.batch}` : typeof sp.course === "string" ? `course:${sp.course}` : undefined;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Announcements</h1>
        <p className="mt-1 text-muted">Notices about schedules, holidays, classes and other updates. They appear in students&apos; portals and notifications, and can also be emailed.</p>
      </div>
      <section aria-labelledby="new" className="glass rounded-2xl p-6">
        <h2 id="new" className="mb-4 text-lg font-semibold text-charcoal-900">New announcement</h2>
        {audiences.length ? (
          <AnnouncementForm audiences={audiences} defaultAudience={audiences.some((a) => a.value === preset) ? preset : undefined} />
        ) : (
          <p className="text-sm text-muted">Once one of your batches is open you can send its students announcements here.</p>
        )}
      </section>
      <section aria-labelledby="sent">
        <h2 id="sent" className="text-lg font-semibold text-charcoal-900">Sent</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No announcements yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {list.map((a) => (
              <li key={a.id} className="glass rounded-2xl p-5" aria-label={a.title}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-charcoal-900" dir="auto">{a.title}</h3>
                    <p className="text-xs text-muted">
                      {a.batch ? `Batch: ${a.batch.name}` : a.course ? `Program: ${a.course.title}` : "All students"} · {a.author?.name ?? "Former team member"} · {dateFmt.format(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.emailSentAt && <StatusBadge tone="off">Emailed</StatusBadge>}
                    <DeleteAnnouncement id={a.id} />
                  </div>
                </div>
                <RichText text={a.body} className="mt-3 text-sm text-charcoal-800" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
