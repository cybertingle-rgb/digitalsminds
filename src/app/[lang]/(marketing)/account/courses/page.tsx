import { redirect } from "next/navigation";
import { hasLocale, localizePath } from "@/i18n/config";

/** Moved: the portal page is now /account/program. */
export default async function MovedPage({ params }: PageProps<"/[lang]/account/courses">) {
  const { lang } = await params;
  redirect(localizePath("/account/program", hasLocale(lang) ? lang : "en"));
}
