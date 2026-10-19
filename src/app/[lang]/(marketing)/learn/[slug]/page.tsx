import { notFound, redirect } from "next/navigation";
import { hasLocale, localizePath } from "@/i18n/config";
import { getCurrentUser } from "@/modules/auth/session";
import { lessonsOf } from "@/modules/learning/catalogue";
import { continueLessonId, learnerContext } from "@/modules/learning/progress";

export const dynamic = "force-dynamic";

/** "Continue learning": jumps to the right lesson, or back to the course page. */
export default async function LearnCoursePage({ params }: PageProps<"/[lang]/learn/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await getCurrentUser();
  const here = localizePath(`/learn/${slug}`, lang);
  if (!user) redirect(`${localizePath("/login", lang)}?next=${encodeURIComponent(here)}`);
  const ctx = await learnerContext(user, slug);
  if (!ctx) notFound();
  const first = lessonsOf(ctx.course)[0];
  const target = ctx.mode === "student" ? await continueLessonId(user.id, ctx.course) : ctx.mode === "staff" ? first?.id : null;
  redirect(target ? `${here}/${target}` : localizePath(`/courses/${slug}`, lang));
}
