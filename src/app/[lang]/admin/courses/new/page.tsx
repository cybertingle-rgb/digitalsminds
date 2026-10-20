import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { NewCourseForm } from "../CourseForms";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const user = await requirePagePermission("admin.access", "/admin/courses/new");
  if (!can(user.role, "courses.manage.all") && !can(user.role, "courses.manage.own")) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/courses" className="text-sm text-muted hover:text-charcoal-900">← All courses</Link>
      <div>
        <h1 className="text-2xl font-bold text-charcoal-900">New course</h1>
        <p className="mt-1 text-muted">Start with the basics. You can add details, modules and lessons next. Nothing is visible to students until it&apos;s published.</p>
      </div>
      <div className="glass rounded-2xl p-6">
        <NewCourseForm />
      </div>
    </div>
  );
}
