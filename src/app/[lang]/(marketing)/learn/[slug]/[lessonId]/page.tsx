import { redirect } from "next/navigation";
import { hasLocale, localizePath } from "@/i18n/config";

/** Online lessons were retired: old links go to the student portal. */
export default async function LessonRedirect({ params }: PageProps<"/[lang]/learn/[slug]/[lessonId]">) {
  const { lang } = await params;
  redirect(localizePath("/account", hasLocale(lang) ? lang : "en"));
}
