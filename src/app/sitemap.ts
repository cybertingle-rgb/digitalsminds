import type { MetadataRoute } from "next";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";
import { getPosts } from "@/content/blog";
import { serviceSlugs } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; lastModified?: string }[] = [
    ...["/", "/about", "/services", "/blog", "/contact"].map((path) => ({ path })),
    ...serviceSlugs.map((slug) => ({ path: `/services/${slug}` })),
    ...getPosts().map((p) => ({ path: `/blog/${p.slug}`, lastModified: p.publishedAt })),
  ];
  // Urdu URLs are listed only once the translation is public (see features.urduPublic).
  const sitemapLocales: Locale[] = features.urduPublic ? ["en", "ur"] : ["en"];
  const url = (path: string, locale: Locale) => `${siteConfig.url}${localizePath(path, locale)}`;

  return pages.flatMap(({ path, lastModified }) =>
    sitemapLocales.map((locale) => ({
      url: url(path, locale),
      ...(lastModified && { lastModified }),
      ...(features.urduPublic ? { alternates: { languages: { en: url(path, "en"), ur: url(path, "ur") } } } : {}),
    })),
  );
}
