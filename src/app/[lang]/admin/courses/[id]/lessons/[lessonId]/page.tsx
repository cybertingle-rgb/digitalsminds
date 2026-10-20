import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/modules/auth/session";
import { getCourseForEdit, pickableMedia } from "@/modules/courses/service";
import { ConfirmDeleteLesson } from "../../../LessonActions";
import { LessonForm } from "../../../LessonForm";
import { resourceItems } from "../../../resource-items";
import { Resources } from "../../../Resources";

export const metadata: Metadata = { title: "Edit lesson" };

export default async function EditLessonPage({ params }: PageProps<"/[lang]/admin/courses/[id]/lessons/[lessonId]">) {
  const { id, lessonId } = await params;
  const user = await requirePagePermission("admin.access", `/admin/courses/${id}/lessons/${lessonId}`);
  const course = await getCourseForEdit(id, user);
  if (!course) notFound();
  const all = course.modules.flatMap((m, mi) => m.lessons.map((l, li) => ({ ...l, label: `Module ${mi + 1}, lesson ${li + 1}`, moduleTitle: m.title })));
  const index = all.findIndex((l) => l.id === lessonId);
  const lesson = all[index];
  if (!lesson) notFound();
  const media = await pickableMedia(user);
  const prev = all[index - 1];
  const next = all[index + 1];

  return (
    <div className="max-w-4xl space-y-6">
      <Link href={`/admin/courses/${course.id}`} className="text-sm text-muted hover:text-charcoal-900" dir="auto">← {course.title}</Link>
      <div>
        <p className="text-sm text-muted" dir="auto">{lesson.label} · {lesson.moduleTitle}</p>
        <h1 className="text-2xl font-bold text-charcoal-900" dir="auto">{lesson.title}</h1>
      </div>

      <section aria-label="Lesson" className="glass rounded-2xl p-6">
        <LessonForm
          lesson={{
            id: lesson.id,
            title: lesson.title,
            videoUrl: lesson.videoUrl ?? "",
            content: lesson.content ?? "",
            durationMinutes: lesson.durationMinutes ? String(lesson.durationMinutes) : "",
            isPreview: lesson.isPreview,
          }}
        />
      </section>

      <section aria-labelledby="lesson-resources" className="glass rounded-2xl p-6">
        <h2 id="lesson-resources" className="mb-4 text-lg font-semibold text-charcoal-900">Lesson resources</h2>
        <Resources
          courseId={course.id}
          lessonId={lesson.id}
          items={resourceItems(lesson.resources)}
          files={media.map((m) => ({ id: m.id, name: m.originalName, isPrivate: m.visibility === "PRIVATE" }))}
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex gap-4">
          {prev && <Link href={`/admin/courses/${course.id}/lessons/${prev.id}`} className="underline underline-offset-4" dir="auto">← {prev.title}</Link>}
          {next && <Link href={`/admin/courses/${course.id}/lessons/${next.id}`} className="underline underline-offset-4" dir="auto">{next.title} →</Link>}
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/admin/courses/${course.id}/preview?lesson=${lesson.id}`} className="font-semibold underline underline-offset-4">Preview as student</Link>
          {lesson._count.progress === 0 && <ConfirmDeleteLesson lessonId={lesson.id} courseId={course.id} title={lesson.title} />}
        </div>
      </div>
    </div>
  );
}
