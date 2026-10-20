import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { db } from "@/lib/db";
import { adminAnnouncements } from "@/modules/announcements/service";
import { can } from "@/modules/auth/permissions";
import { manageableCoursesWhere } from "@/modules/auth/scoping";
import { requirePagePermission } from "@/modules/auth/session";
import { RichText } from "@/modules/courses/richtext";
import { AnnouncementForm, DeleteAnnouncement } from "./AnnouncementForms";

export const metadata: Metadata = { title: "Announcements" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });

export default async function AnnouncementsPage({ searchParams }: PageProps<"/[lang]/admin/announcements">) {
  const user = await requirePagePermission("admin.access", "/admin/announcements");
  const site = can(user.role, "announcements.site");
  if (!site && !can(user.role, "courses.manage.all") && !can(user.role, "courses.manage.own")) notFound();
  const sp = await searchParams;
  const [courses, list] = await Promise.all([
    db().course.findMany({ where: { AND: [manageableCoursesWhere(user), { status: { not: "DRAFT" } }] }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    adminAnnouncements(user),
  ]);
  const audiences = [...(site ? [{ value: "", label: "All students" }] : []), ...courses.map((c) => ({ value: c.id, label: `Students of: ${c.title}` }))];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">Announcements</h1>
        <p className="mt-1 text-muted">Messages appear in students&apos; accounts and notifications, and can also be emailed.</p>
      </div>
      <section aria-labelledby="new" className="glass rounded-2xl p-6">
        <h2 id="new" className="mb-4 text-lg font-semibold text-charcoal-900">New announcement</h2>
        {audiences.length ? (
          <AnnouncementForm audiences={audiences} defaultCourse={typeof sp.course === "string" ? sp.course : undefined} />
        ) : (
          <p className="text-sm text-muted">Once one of your courses is published you can send its students announcements here.</p>
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
                      {a.course ? `Students of ${a.course.title}` : "All students"} · {a.author?.name ?? "Former team member"} · {dateFmt.format(a.createdAt)}
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
