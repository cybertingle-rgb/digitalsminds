import { redirect } from "next/navigation";
import { hasLocale, localizePath } from "@/i18n/config";

/** Paying is now part of the application: old payment links go to the program page. */
export default async function PayRedirect({ params }: PageProps<"/[lang]/courses/[slug]/pay">) {
  const { lang, slug } = await params;
  redirect(localizePath(`/courses/${encodeURIComponent(slug)}`, hasLocale(lang) ? lang : "en"));
}
