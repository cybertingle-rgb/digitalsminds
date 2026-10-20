import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/modules/auth/session";
import { driveEmbedUrl, driveFileId } from "@/modules/courses/drive";
import { courseStatusLabels, formatMinutes, languageLabels, levelLabels } from "@/modules/courses/labels";
import { RichText } from "@/modules/courses/richtext";
import { getCourseForEdit } from "@/modules/courses/service";
import { mediaUrl } from "@/modules/media/service";
import { resourceItems } from "../../resource-items";

export const metadata: Metadata = { title: "Course preview" };

/** What an enrolled student will see. Staff-only; works for drafts too. */
export default async function CoursePreviewPage({ params, searchParams }: PageProps<"/[lang]/admin/courses/[id]/preview">) {
  const { id } = await params;
  const user = await requirePagePermission("admin.access", `/admin/courses/${id}/preview`);
  const course = await getCourseForEdit(id, user);
  if (!course) notFound();
  const sp = await searchParams;
  const lessons = course.modules.flatMap((m) => m.lessons);
  const lesson = lessons.find((l) => l.id === sp.lesson);
  const objectives = Array.isArray(course.objectives) ? (course.objectives as unknown[]).filter((o): o is string => typeof o === "string") : [];
  const total = formatMinutes(course.durationMinutes ?? (lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0) || null));
  const ur = course.language === "ur";
  const href = (lessonId?: string) => `/admin/courses/${course.id}/preview${lessonId ? `?lesson=${lessonId}` : ""}`;
  const index = lesson ? lessons.indexOf(lesson) : -1;
  const fileId = lesson?.videoUrl ? driveFileId(lesson.videoUrl) : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sun-400 bg-sun-50 px-4 py-3 text-sm text-charcoal-900">
        <p><span className="font-semibold">Student preview</span> · {courseStatusLabels[course.status]}. This is how enrolled students will see the course.</p>
        <Link href={lesson ? `/admin/courses/${course.id}/lessons/${lesson.id}` : `/admin/courses/${course.id}`} className="font-semibold underline underline-offset-4">
          {lesson ? "Edit this lesson" : "Back to editor"}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" dir={ur ? "rtl" : "ltr"} lang={course.language}>
        <article className="min-w-0 space-y-6 lg:col-span-2">
          {lesson ? (
            <>
              <header>
                <p className="text-sm text-muted"><Link href={href()} className="hover:underline">{course.title}</Link></p>
                <h1 className="text-2xl font-bold text-charcoal-900">{lesson.title}</h1>
                {formatMinutes(lesson.durationMinutes) && <p className="mt-1 text-sm text-muted" dir="ltr">{formatMinutes(lesson.durationMinutes)}</p>}
              </header>
              {fileId && (
                <div className="space-y-2">
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-charcoal-900">
                    <iframe src={driveEmbedUrl(fileId)} title={lesson.title} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full" />
                  </div>
                  <a href={lesson.videoUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl border border-white/80 bg-white/60 shadow-sm px-4 py-2 text-sm font-semibold text-charcoal-900 hover:bg-white/90">
                    Open in Google Drive
                  </a>
                </div>
              )}
              {lesson.content && <div className="glass rounded-2xl p-6"><RichText text={lesson.content} className="text-charcoal-800" /></div>}
              {!fileId && !lesson.content && <p className="glass-subtle rounded-2xl border-dashed !border-charcoal-300/70 p-6 text-muted">This lesson has no video or text yet.</p>}
              <ResourceList items={resourceItems(lesson.resources)} />
              <nav className="flex justify-between gap-4 text-sm" aria-label="Lesson navigation">
                {lessons[index - 1] ? <Link href={href(lessons[index - 1]!.id)} className="underline underline-offset-4">← {lessons[index - 1]!.title}</Link> : <span />}
                {lessons[index + 1] && <Link href={href(lessons[index + 1]!.id)} className="underline underline-offset-4">{lessons[index + 1]!.title} →</Link>}
              </nav>
            </>
          ) : (
            <>
              {course.thumbnail && (
                <div className="relative aspect-video overflow-hidden rounded-2xl bg-charcoal-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(course.thumbnail)} alt={course.thumbnail.altText ?? ""} className="absolute inset-0 h-full w-full object-cover" />
                </div>
              )}
              <header>
                <h1 className="text-3xl font-bold text-charcoal-900">{course.title}</h1>
                <p className="mt-2 text-lg text-charcoal-700">{course.summary}</p>
                <p className="mt-3 flex flex-wrap gap-x-4 text-sm text-muted">
                  <span>{levelLabels[course.level]}</span>
                  <span>{languageLabels[course.language]}</span>
                  {total && <span dir="ltr">{total}</span>}
                  <span>{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}</span>
                  {course.certificateEnabled && <span>Certificate of completion</span>}
                </p>
              </header>
              {objectives.length > 0 && (
                <section className="glass rounded-2xl p-6">
                  <h2 className="font-semibold text-charcoal-900">What you&apos;ll learn</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {objectives.map((o) => <li key={o} className="flex gap-2 text-charcoal-800"><span aria-hidden className="text-sun-500">✓</span>{o}</li>)}
                  </ul>
                </section>
              )}
              {course.description && <section className="glass rounded-2xl p-6"><RichText text={course.description} className="text-charcoal-800" /></section>}
              {course.prerequisites && (
                <section className="glass rounded-2xl p-6">
                  <h2 className="font-semibold text-charcoal-900">Before you start</h2>
                  <RichText text={course.prerequisites} className="mt-3 text-charcoal-800" />
                </section>
              )}
              <ResourceList items={resourceItems(course.resources)} />
            </>
          )}
        </article>

        <aside className="min-w-0">
          <nav aria-label="Course contents" className="glass rounded-2xl p-4 lg:sticky lg:top-4">
            <h2 className="px-2 font-semibold text-charcoal-900">Course contents</h2>
            {course.modules.length === 0 && <p className="mt-2 px-2 text-sm text-muted">No lessons yet.</p>}
            <ol className="mt-2 space-y-3">
              {course.modules.map((m) => (
                <li key={m.id}>
                  <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">{m.title}</p>
                  <ol className="mt-1">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={href(l.id)}
                          aria-current={l.id === lesson?.id ? "page" : undefined}
                          className={`flex justify-between gap-2 rounded-lg px-2 py-1.5 text-sm ${l.id === lesson?.id ? "bg-sun-100 font-semibold text-charcoal-900" : "text-charcoal-800 hover:bg-white/90"}`}
                        >
                          <span>{l.title}</span>
                          {formatMinutes(l.durationMinutes) && <span className="shrink-0 text-xs text-muted" dir="ltr">{formatMinutes(l.durationMinutes)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function ResourceList({ items }: { items: ReturnType<typeof resourceItems> }) {
  if (items.length === 0) return null;
  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="font-semibold text-charcoal-900">Resources</h2>
      <ul className="mt-3 space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-charcoal-900 underline underline-offset-4">{r.title}</a>
            <span className="ms-2 text-xs text-muted">{r.kind === "FILE" ? "Download" : "Link"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
