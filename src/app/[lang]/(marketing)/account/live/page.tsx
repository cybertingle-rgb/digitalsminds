import { redirect } from "next/navigation";
import { hasLocale, localizePath } from "@/i18n/config";

/** Moved: the portal page is now /account/schedule. */
export default async function MovedPage({ params }: PageProps<"/[lang]/account/live">) {
  const { lang } = await params;
  redirect(localizePath("/account/schedule", hasLocale(lang) ? lang : "en"));
}
