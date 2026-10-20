import "server-only";
import { siteConfig } from "@/config/site";
import { localizePath, localeMeta, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getLogos } from "@/modules/content/settings";
import { getSocialLinks } from "@/modules/settings/social";

/**
 * schema.org data for search engines (rendered by <JsonLd>). Describes only
 * facts shown on the page: no ratings, reviews or prices are invented.
 */

export type Thing = Record<string, unknown>;

export const ORG_ID = `${siteConfig.url}/#organization`;
const WEBSITE_ID = `${siteConfig.url}/#website`;

export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteConfig.url}${path.startsWith("/") ? "" : "/"}${path}`);

/** Short reference to the organisation, for publisher/provider fields. */
export async function orgRef(dict: Dictionary): Promise<Thing> {
  const { light } = await getLogos();
  return { "@type": "Organization", "@id": ORG_ID, name: dict.brand.name, url: siteConfig.url, logo: absolute(light.src) };
}

/** Organization + WebSite, on the homepage. */
export async function organizationGraph(locale: Locale, dict: Dictionary, contact: { email: string }): Promise<Thing> {
  const [{ light }, social] = await Promise.all([getLogos(), getSocialLinks()]);
  const sameAs = Object.values(social).filter((v): v is string => Boolean(v));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: dict.brand.name,
        url: siteConfig.url,
        logo: { "@type": "ImageObject", url: absolute(light.src), width: light.width, height: light.height },
        image: absolute(siteConfig.ogImage.src),
        description: dict.meta.description,
        email: contact.email,
        address: { "@type": "PostalAddress", ...siteConfig.postalAddress },
        ...(sameAs.length && { sameAs }),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: absolute(localizePath("/", locale)),
        name: dict.brand.name,
        inLanguage: localeMeta[locale].htmlLang,
        publisher: { "@id": ORG_ID },
      },
    ],
  };
}

/** Breadcrumb trail; the last item is the current page. */
export function breadcrumbs(locale: Locale, items: { name: string; path: string }[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absolute(localizePath(it.path, locale)) })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>" in the content. */
export function serialiseJsonLd(data: Thing) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
