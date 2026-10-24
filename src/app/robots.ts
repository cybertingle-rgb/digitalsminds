import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/account", "/application", "/learn", "/setup", "/ur/admin", "/ur/account", "/ur/application", "/ur/learn", "/ur/setup"] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
