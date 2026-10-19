import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/Field";
import { db } from "@/lib/db";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { listStudents, parseStudentFilters } from "@/modules/students/service";

export const metadata: Metadata = { title: "Students" };

const PAGE_SIZE = 25;
const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function StudentsPage({ searchParams }: PageProps<"/[lang]/admin/students">) {
  const user = await requirePagePermission("students.view", "/admin/students");
  const sp = await searchParams;
  const f = parseStudentFilters(sp);
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const [{ items, total }, courses] = await Promise.all([
    listStudents(f, page, PAGE_SIZE),
    db().course.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  const params = (over: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    const merged = { q: f.q, status: f.status, course: f.courseId, enrollment: f.enrollment, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return p.toString();
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(f.q || f.status || f.courseId || f.enrollment);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal-900">Students</h1>
          <p className="mt-1 text-muted">{total} {total === 1 ? "student" : "students"}{filtered ? " match these filters" : ""}.</p>
        </div>
        {can(user.role, "students.export") && (
          <a href={`/api/admin/students/export?${params()}`} className="rounded-lg border border-charcoal-200 bg-white px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-charcoal-50">
            Export CSV
          </a>
        )}
      </div>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-charcoal-900">Search</label>
          <input id="q" name="q" defaultValue={f.q} placeholder="Name, email, phone or city" className={`${inputClass} w-64`} />
        </div>
        <div>
          <label htmlFor="enrollment" className="block text-sm font-medium text-charcoal-900">Courses</label>
          <select id="enrollment" name="enrollment" defaultValue={f.enrollment ?? ""} className={inputClass}>
            <option value="">Any</option>
            <option value="enrolled">Enrolled in a course</option>
            <option value="waiting">Waiting for approval</option>
            <option value="none">Not enrolled</option>
          </select>
        </div>
        <div>
          <label htmlFor="course" className="block text-sm font-medium text-charcoal-900">Enrolled in</label>
          <select id="course" name="course" defaultValue={f.courseId ?? ""} className={`${inputClass} max-w-64`}>
            <option value="">Any course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-charcoal-900">Account</label>
          <select id="status" name="status" defaultValue={f.status ?? ""} className={inputClass}>
            <option value="">Any</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-charcoal-900 px-4 py-2.5 text-sm font-semibold text-white">Apply filters</button>
        {filtered && <Link href="/admin/students" className="py-2.5 text-sm text-muted underline">Clear</Link>}
      </form>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-charcoal-200 bg-white p-8 text-center text-muted">
          {filtered ? "No students match these filters." : "No student accounts yet. Students appear here when they register."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-surface-alt text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Student</th>
                <th scope="col" className="px-4 py-3">City</th>
                <th scope="col" className="px-4 py-3">Courses</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-charcoal-900 hover:underline" dir="auto">{s.name}</Link>
                    {s.status === "SUSPENDED" && <span className="ms-2"><StatusBadge tone="warn">Suspended</StatusBadge></span>}
                    {!s.emailVerified && <span className="ms-2"><StatusBadge tone="off">Not verified</StatusBadge></span>}
                    <p className="text-xs text-muted" dir="ltr">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-charcoal-800" dir="auto">{s.city ?? "-"}</td>
                  <td className="px-4 py-3 text-charcoal-800">
                    {s.enrolled.length} enrolled{s.completed.length > 0 && ` · ${s.completed.length} completed`}
                    {s.waiting.length > 0 && <span className="block text-xs text-gold-700">{s.waiting.length} waiting</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{dateFmt.format(s.createdAt)}</td>
                  <td className="px-4 py-3 text-muted">{s.lastActive ? dateFmt.format(s.lastActive) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={`/admin/students?${params({ page: String(page - 1) })}`} className="underline">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/admin/students?${params({ page: String(page + 1) })}`} className="underline">Next</Link>}
        </nav>
      )}
    </div>
  );
}
