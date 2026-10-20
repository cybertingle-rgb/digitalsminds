import type { Metadata } from "next";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";
import { locales, localeMeta, localizePath, type Locale } from "./config";

/**
 * Canonical URL, language alternates (hreflang) and indexing rules for a page.
 * Urdu pages are noindex and have no hreflang until features.urduPublic is on.
 */
export function pageMetadata(
  locale: Locale,
  path: string,
  meta: { title?: string; description?: string; absoluteTitle?: boolean; image?: { url: string; width?: number; height?: number } },
): Metadata {
  const canonical = localizePath(path, locale);
  const languages = features.urduPublic
    ? {
        ...Object.fromEntries(locales.map((l) => [localeMeta[l].htmlLang, localizePath(path, l)])),
        "x-default": localizePath(path, "en"),
      }
    : undefined;

  return {
    ...(meta.title && { title: meta.absoluteTitle ? { absolute: meta.title } : meta.title }),
    ...(meta.description && { description: meta.description }),
    alternates: { canonical, languages },
    openGraph: {
      url: canonical,
      locale: localeMeta[locale].intl.replace("-", "_"),
      ...(meta.title && { title: meta.title }),
      ...(meta.description && { description: meta.description }),
      images: [meta.image ?? { url: siteConfig.ogImage.src, width: siteConfig.ogImage.width, height: siteConfig.ogImage.height }],
    },
    ...(locale === "ur" && !features.urduPublic ? { robots: { index: false, follow: true } } : {}),
  };
}
