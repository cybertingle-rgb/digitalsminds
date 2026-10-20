import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompleteButton } from "@/components/learning/CompleteButton";
import { DriveVideo } from "@/components/learning/DriveVideo";
import { formatDuration } from "@/components/learning/format";
import { FormAlert } from "@/components/forms/Field";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { hasLocale, localeMeta, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { getCurrentUser } from "@/modules/auth/session";
import { validCertificateFor } from "@/modules/certificates/service";
import { RichText } from "@/modules/courses/richtext";
import { lessonsOf, listingText } from "@/modules/learning/catalogue";
import { canOpenLesson, completedLessonIds, learnerContext, recordView } from "@/modules/learning/progress";
import { mediaUrl } from "@/modules/media/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LessonPage({ params }: PageProps<"/[lang]/learn/[slug]/[lessonId]">) {
  const { lang, slug, lessonId } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const t = dict.learn;
  const user = await getCurrentUser();
  const ctx = await learnerContext(user, slug);
  if (!ctx) notFound();
  const { course, mode, enrollment } = ctx;
  const lessons = lessonsOf(course);
  const index = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessons[index];
  if (!lesson) notFound();
  const coursePage = localizePath(`/courses/${course.slug}`, lang);

  if (!canOpenLesson(mode, lesson)) {
    if (enrollment?.status === "APPROVED") {
      // Enrolled, but the course was moved back to draft.
      return (
        <Container className="py-16">
          <FormAlert tone="info">{t.unavailable}</FormAlert>
        </Container>
      );
    }
    const here = localizePath(`/learn/${course.slug}/${lesson.id}`, lang);
    redirect(user ? coursePage : `${localizePath("/login", lang)}?next=${encodeURIComponent(here)}`);
  }

  const student = mode === "student" && user;
  if (student) await recordView(user.id, lesson.id);
  const completed = student ? await completedLessonIds(user.id, course) : new Set<string>();
  const cert = student && completed.size === lessons.length ? await validCertificateFor(user.id, course.id) : null;
  const href = (id: string) => localizePath(`/learn/${course.slug}/${id}`, lang);
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const visibleLessons = mode === "preview" ? lessons.filter((l) => l.isPreview) : lessons;
  // Private files are for enrolled students and staff only.
  const resources = [...lesson.resources].filter((r) => mode !== "preview" || r.kind === "LINK" || r.mediaAsset?.visibility === "PUBLIC");
  const percent = lessons.length ? Math.round((completed.size / lessons.length) * 100) : 0;
  const courseDir = localeMeta[course.language].dir;
  const googleEmail = user?.googleEmail ?? null;

  return (
    <Container className="py-8 sm:py-10">
      {mode === "preview" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sun-50 px-4 py-3 text-sm text-charcoal-900 ring-1 ring-sun-400">
          <p>{t.previewBanner}</p>
          <Link href={coursePage} className="font-semibold underline underline-offset-4">{t.previewCta}</Link>
        </div>
      )}
      {mode === "staff" && <p className="mb-6 glass-subtle rounded-xl px-4 py-3 text-sm text-muted">{t.staffBanner}</p>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <article className="min-w-0 space-y-6 lg:col-span-2">
          <header>
            <p className="text-sm text-muted">
              <Link href={coursePage} className="hover:text-charcoal-900" dir="auto">{listingText(course, lang).title}</Link>
            </p>
            <h1 className="mt-1 text-2xl font-bold text-charcoal-900 sm:text-3xl" dir="auto">{lesson.title}</h1>
            {formatDuration(lesson.durationMinutes, dict) && <p className="mt-1 text-sm text-muted">{formatDuration(lesson.durationMinutes, dict)}</p>}
          </header>

          {lesson.videoUrl && (
            <DriveVideo
              url={lesson.videoUrl}
              title={lesson.title}
              openLabel={t.openInDrive}
              help={mode === "preview" ? undefined : googleEmail ? format(t.videoHelp, { email: googleEmail }) : t.videoHelpNoEmail}
            />
          )}
          {lesson.content && (
            <div className="glass rounded-2xl p-6" dir={courseDir} lang={course.language}>
              <RichText text={lesson.content} className="text-charcoal-800" />
            </div>
          )}
          {!lesson.videoUrl && !lesson.content && <p className="glass-subtle rounded-2xl p-6 text-muted">{t.noContent}</p>}

          {resources.length > 0 && (
            <section aria-labelledby="res-title" className="glass rounded-2xl p-6">
              <h2 id="res-title" className="font-semibold text-charcoal-900">{t.resources}</h2>
              <ul className="mt-3 space-y-2">
                {resources.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-2">
                    <a href={r.mediaAsset ? mediaUrl(r.mediaAsset) : (r.url ?? "#")} target="_blank" rel="noopener noreferrer" className="text-charcoal-900 underline underline-offset-4" dir="auto">
                      {r.title}
                    </a>
                    <span className="text-xs text-muted">{r.kind === "FILE" ? t.download : t.link}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {student && (
            <CompleteButton
              slug={course.slug}
              lessonId={lesson.id}
              done={completed.has(lesson.id)}
              labels={{ mark: t.markComplete, completed: t.completed, undo: t.markIncomplete }}
            />
          )}
          {student && lessons.length > 0 && completed.size === lessons.length && (
            <FormAlert tone="success">
              {t.courseComplete}
              {cert ? (
                <> <Link href={localizePath(`/certificates/${cert.code}`, lang)} className="font-semibold underline underline-offset-4">{dict.certificates.view}</Link></>
              ) : (
                course.certificateEnabled && <> {dict.certificates.pendingReview}</>
              )}
            </FormAlert>
          )}

          {mode !== "preview" && (
            <nav aria-label={t.contents} className="flex flex-wrap justify-between gap-3 border-t border-line pt-6">
              {prev ? <LinkButton href={href(prev.id)} variant="secondary">{t.previous}</LinkButton> : <span />}
              {next && <LinkButton href={href(next.id)}>{t.next}</LinkButton>}
            </nav>
          )}
        </article>

        <aside className="min-w-0">
          <nav aria-labelledby="contents-title" className="glass rounded-2xl p-4 lg:sticky lg:top-24">
            <h2 id="contents-title" className="px-2 font-semibold text-charcoal-900">{t.contents}</h2>
            {student && (
              <div className="mt-3 px-2">
                <div className="h-2 overflow-hidden rounded-full bg-charcoal-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={format(t.progress, { done: String(completed.size), total: String(lessons.length) })}>
                  <div className="h-full rounded-full bg-sun-400" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">{format(t.progress, { done: String(completed.size), total: String(lessons.length) })}</p>
              </div>
            )}
            <ol className="mt-3 space-y-3">
              {course.modules.map((m) => {
                const items = m.lessons.filter((l) => visibleLessons.includes(l));
                if (!items.length) return null;
                return (
                  <li key={m.id}>
                    <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted" dir="auto">{m.title}</p>
                    <ol className="mt-1">
                      {items.map((l) => (
                        <li key={l.id}>
                          <Link
                            href={href(l.id)}
                            aria-current={l.id === lesson.id ? "page" : undefined}
                            className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${l.id === lesson.id ? "bg-sun-100 font-semibold text-charcoal-900" : "text-charcoal-800 hover:bg-charcoal-50"}`}
                          >
                            {student && (
                              <span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${completed.has(l.id) ? "bg-green-700 text-white" : "ring-1 ring-charcoal-300"}`}>
                                {completed.has(l.id) ? "✓" : ""}
                              </span>
                            )}
                            <span className="min-w-0 flex-1" dir="auto">
                              {l.title}
                              {student && completed.has(l.id) && <span className="sr-only"> ({t.completed})</span>}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>
      </div>
    </Container>
  );
}
