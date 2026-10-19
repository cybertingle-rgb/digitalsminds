import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { LinkButton } from "@/components/ui/Button";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { courseStatusLabels, languageLabels } from "@/modules/courses/labels";
import { listCourses } from "@/modules/courses/service";
import { mediaUrl } from "@/modules/media/service";

export const metadata: Metadata = { title: "Courses" };

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function CoursesPage({ searchParams }: PageProps<"/[lang]/admin/courses">) {
  const user = await requirePagePermission("admin.access", "/admin/courses");
  const manageAll = can(user.role, "courses.manage.all");
  if (!manageAll && !can(user.role, "courses.manage.own")) notFound();
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const list = await listCourses(user, status);

  const tabs = [{ label: "All", href: "/admin/courses", active: !status }, ...STATUSES.map((s) => ({ label: courseStatusLabels[s], href: `/admin/courses?status=${s}`, active: status === s }))];

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Courses</h1>
          <p className="mt-1 text-muted">
            {manageAll ? "All courses." : "Courses you teach."}{" "}
            {can(user.role, "courses.publish") ? "Drafts are only visible to the team until you publish them." : "A Content Manager or Super Admin publishes your course when it's ready."}
          </p>
        </div>
        <LinkButton href="/admin/courses/new" variant="dark">New course</LinkButton>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${t.active ? "bg-charcoal-900 text-white" : "border border-line bg-white text-charcoal-800 hover:bg-charcoal-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-charcoal-200 bg-white p-10 text-center">
          <p className="font-semibold text-charcoal-900">{status ? `No ${courseStatusLabels[status].toLowerCase()} courses.` : "No courses yet."}</p>
          {!status && <p className="mt-1 text-sm text-muted">Create your first course, add modules and lessons, then publish it.</p>}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-video bg-charcoal-100">
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(c.thumbnail)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">No thumbnail</span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={c.status === "PUBLISHED" ? "ok" : c.status === "DRAFT" ? "warn" : "off"}>{courseStatusLabels[c.status]}</StatusBadge>
                  <StatusBadge tone="off">{languageLabels[c.language]}</StatusBadge>
                </div>
                <h2 className="mt-3 font-semibold text-charcoal-900" dir="auto">
                  <Link href={`/admin/courses/${c.id}`} className="hover:underline">{c.title}</Link>
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted" dir="auto">{c.summary}</p>
                <p className="mt-auto pt-3 text-xs text-muted">
                  {c._count.modules} {c._count.modules === 1 ? "module" : "modules"} · {c._count.enrollments} {c._count.enrollments === 1 ? "student" : "students"} · updated {dateFmt.format(c.updatedAt)}
                  {c.instructors.length > 0 && <><br />Instructors: {c.instructors.map((i) => i.user.name).join(", ")}</>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
