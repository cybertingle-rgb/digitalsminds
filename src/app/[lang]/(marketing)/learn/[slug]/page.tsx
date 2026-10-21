import { redirect } from "next/navigation";
import { hasLocale, localizePath } from "@/i18n/config";

/** Online lessons were retired: old links go to the student portal. */
export default async function LearnRedirect({ params }: PageProps<"/[lang]/learn/[slug]">) {
  const { lang } = await params;
  redirect(localizePath("/account", hasLocale(lang) ? lang : "en"));
}
