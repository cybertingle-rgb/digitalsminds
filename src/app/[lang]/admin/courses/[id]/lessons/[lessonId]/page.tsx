import { redirect } from "next/navigation";

/** Lessons were retired; the program page is where details live now. */
export default async function LessonEditRedirect({ params }: PageProps<"/[lang]/admin/courses/[id]/lessons/[lessonId]">) {
  redirect(`/admin/courses/${(await params).id}`);
}
