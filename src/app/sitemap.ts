import type { MetadataRoute } from "next";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";
import { serviceSlugs } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import { db } from "@/lib/db";
import { publicPosts } from "@/modules/content/blog";
import { publishedCaseStudies } from "@/modules/content/items";
import { getLegalPage } from "@/modules/content/settings";

// Generated on request (one small query), so newly published courses appear straight away.
export const dynamic = "force-dynamic";

async function publishedCourseEntries() {
  try {
    const courses = await db().course.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } });
    return courses.map((c) => ({ path: `/courses/${c.slug}`, lastModified: c.updatedAt.toISOString() }));
  } catch {
    // Database not reachable: still list the static pages.
    return [];
  }
}

async function contentEntries() {
  const [posts, cases, privacy, terms, refund] = await Promise.all([publicPosts(), publishedCaseStudies(), getLegalPage("privacy"), getLegalPage("terms"), getLegalPage("refund")]);
  return [
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, lastModified: p.updatedAt ?? p.publishedAt })),
    ...(cases.length ? [{ path: "/case-studies" }] : []),
    ...cases.map((c) => ({ path: `/case-studies/${c.slug}`, lastModified: c.updatedAt.toISOString() })),
    ...(privacy?.published ? [{ path: "/privacy" }] : []),
    ...(terms?.published ? [{ path: "/terms" }] : []),
    ...(refund?.published ? [{ path: "/refund-policy" }] : []),
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: { path: string; lastModified?: string }[] = [
    ...["/", "/about", "/services", "/courses", "/blog", "/contact"].map((path) => ({ path })),
    ...(await publishedCourseEntries()),
    ...serviceSlugs.map((slug) => ({ path: `/services/${slug}` })),
    ...(await contentEntries()),
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
