import "server-only";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { pageMetadata } from "@/i18n/metadata";
import { seoFor, type SeoPage } from "./settings";

/** pageMetadata() with the search title/description/share image set in Admin → Website → SEO. */
export async function editablePageMetadata(
  page: SeoPage,
  locale: Locale,
  path: string,
  defaults: { title: string; description: string; absoluteTitle?: boolean },
): Promise<Metadata> {
  const o = await seoFor(page, locale);
  return pageMetadata(locale, path, {
    title: o.title || defaults.title,
    description: o.description || defaults.description,
    absoluteTitle: o.title ? true : defaults.absoluteTitle,
    image: o.image,
  });
}
