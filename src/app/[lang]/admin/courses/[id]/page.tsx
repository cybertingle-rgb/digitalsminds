import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/admin/ui";
import { serviceSlugs } from "@/content/services";
import { can } from "@/modules/auth/permissions";
import { requirePagePermission } from "@/modules/auth/session";
import { courseStatusLabels, languageLabels } from "@/modules/courses/labels";
import { availableInstructors, getCourseForEdit, pickableMedia, publishChecklist, publishWarnings } from "@/modules/courses/service";
import { serviceLabel } from "@/modules/inquiries/labels";
import { courseStudents } from "@/modules/learning/enrollment";
import { mediaUrl } from "@/modules/media/service";
import { DetailsForm, InstructorsForm, PublishPanel } from "../CourseForms";
import { Curriculum } from "../Curriculum";
import { resourceItems } from "../resource-items";
import { Resources } from "../Resources";

export const metadata: Metadata = { title: "Edit course" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" });

export default async function EditCoursePage({ params }: PageProps<"/[lang]/admin/courses/[id]">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/courses/${id}`);
  const course = await getCourseForEdit(id, user);
  if (!course) notFound();
  const manageAll = can(user.role, "courses.manage.all");
  const [media, instructors, roster] = await Promise.all([pickableMedia(user), manageAll ? availableInstructors() : Promise.resolve([]), courseStudents(course.id)]);

  const images = media.filter((m) => m.visibility === "PUBLIC" && m.mimeType.startsWith("image/")).map((m) => ({ id: m.id, name: m.originalName, url: mediaUrl(m) }));
  // The current thumbnail stays selectable even if someone else uploaded it.
  if (course.thumbnail && !images.some((i) => i.id === course.thumbnail!.id)) {
    images.unshift({ id: course.thumbnail.id, name: course.thumbnail.originalName, url: mediaUrl(course.thumbnail) });
  }
  const files = media.map((m) => ({ id: m.id, name: m.originalName, isPrivate: m.visibility === "PRIVATE" }));
  const objectives = Array.isArray(course.objectives) ? (course.objectives as unknown[]).filter((o): o is string => typeof o === "string") : [];
  const checklist = publishChecklist(course);

  return (
    <div className="max-w-6xl space-y-6">
      <Link href="/admin/courses" className="text-sm text-muted hover:text-charcoal-900">← All courses</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-charcoal-900" dir="auto">{course.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge tone={course.status === "PUBLISHED" ? "ok" : course.status === "DRAFT" ? "warn" : "off"}>{courseStatusLabels[course.status]}</StatusBadge>
            <StatusBadge tone="off">{languageLabels[course.language]}</StatusBadge>
            {course.publishedAt && <span>First published {dateFmt.format(course.publishedAt)}</span>}
            <span>· {course._count.enrollments} {course._count.enrollments === 1 ? "student" : "students"}</span>
          </div>
        </div>
        <Link href={`/admin/courses/${course.id}/preview`} className="rounded-xl border border-white/80 bg-white/60 shadow-sm px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-white/90">
          Preview as student
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section aria-labelledby="curriculum" className="glass rounded-2xl p-6">
            <h2 id="curriculum" className="text-lg font-semibold text-charcoal-900">Curriculum</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Modules group lessons. Open a lesson to add its Google Drive video, text and resources.</p>
            <Curriculum
              courseId={course.id}
              modules={course.modules.map((m) => ({
                id: m.id,
                title: m.title,
                lessons: m.lessons.map((l) => ({
                  id: l.id,
                  title: l.title,
                  hasVideo: !!l.videoUrl,
                  hasText: !!l.content,
                  isPreview: l.isPreview,
                  durationMinutes: l.durationMinutes,
                  resources: l.resources.length,
                  progress: l._count.progress,
                })),
              }))}
            />
          </section>

          <section aria-labelledby="details" className="glass rounded-2xl p-6">
            <h2 id="details" className="mb-4 text-lg font-semibold text-charcoal-900">Course details</h2>
            <DetailsForm
              course={{
                id: course.id,
                title: course.title,
                titleUr: course.titleUr ?? "",
                slug: course.slug,
                slugLocked: !!course.publishedAt,
                language: course.language,
                summary: course.summary,
                summaryUr: course.summaryUr ?? "",
                description: course.description ?? "",
                objectives: objectives.join("\n"),
                prerequisites: course.prerequisites ?? "",
                level: course.level,
                durationMinutes: course.durationMinutes ? String(course.durationMinutes) : "",
                thumbnailId: course.thumbnailId ?? "",
                serviceSlug: course.serviceSlug ?? "",
                certificateEnabled: course.certificateEnabled,
                seoTitle: course.seoTitle ?? "",
                seoDescription: course.seoDescription ?? "",
              }}
              images={images}
              services={serviceSlugs.map((slug) => ({ slug, title: serviceLabel(slug) }))}
            />
          </section>

          <section aria-labelledby="course-resources" className="glass rounded-2xl p-6">
            <h2 id="course-resources" className="text-lg font-semibold text-charcoal-900">Course resources</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Materials for the whole course. Lesson-specific files are added inside each lesson.</p>
            <Resources courseId={course.id} lessonId={null} items={resourceItems(course.resources)} files={files} />
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section aria-labelledby="publish" className="glass rounded-2xl p-6">
            <h2 id="publish" className="mb-4 text-lg font-semibold text-charcoal-900">Publishing</h2>
            <PublishPanel
              courseId={course.id}
              status={course.status}
              canPublish={can(user.role, "courses.publish")}
              checklist={checklist}
              warnings={publishWarnings(course)}
              deletable={course.status === "DRAFT" && course._count.enrollments === 0 && course._count.certificates === 0}
              enrollments={course._count.enrollments}
            />
          </section>

          <section aria-labelledby="instructors" className="glass rounded-2xl p-6">
            <h2 id="instructors" className="mb-4 text-lg font-semibold text-charcoal-900">Instructors</h2>
            {manageAll ? (
              <InstructorsForm courseId={course.id} assigned={course.instructors.map((i) => i.userId)} options={instructors} />
            ) : (
              <ul className="space-y-1 text-sm">
                {course.instructors.map((i) => <li key={i.userId}>{i.user.name}</li>)}
              </ul>
            )}
          </section>

          <section aria-labelledby="students" className="glass rounded-2xl p-6">
            <h2 id="students" className="text-lg font-semibold text-charcoal-900">Students ({roster.students.length})</h2>
            {roster.waiting > 0 && (
              <p className="mt-2 text-sm">
                {can(user.role, "enrollments.decide") ? (
                  <Link href={`/admin/enrollments?course=${course.id}`} className="font-semibold underline underline-offset-4">{roster.waiting} waiting for approval</Link>
                ) : (
                  `${roster.waiting} waiting for approval`
                )}
              </p>
            )}
            {roster.students.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No enrolled students yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-sm">
                {roster.students.map((s) => (
                  <li key={s.id} className="py-2">
                    <p className="font-medium text-charcoal-900" dir="auto">{s.name}</p>
                    <p className="truncate text-xs text-muted" dir="ltr">{s.googleEmail ?? s.email}</p>
                    <p className="text-xs text-muted">{s.done} of {roster.lessonCount} lessons complete</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {course.serviceSlug && <p className="text-xs text-muted">Related service: {serviceLabel(course.serviceSlug)}</p>}
        </aside>
      </div>
    </div>
  );
}
