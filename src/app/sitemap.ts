import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getPosts } from "@/content/blog";
import { services } from "@/content/services";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${siteConfig.url}${path}`;
  return [
    ...["/", "/about", "/services", "/blog", "/contact"].map((p) => ({ url: url(p) })),
    ...services.map((s) => ({ url: url(`/services/${s.slug}`) })),
    ...getPosts().map((p) => ({ url: url(`/blog/${p.slug}`), lastModified: p.publishedAt })),
  ];
}
