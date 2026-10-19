/**
 * Core Digitals Minds divisions, in display order. Their text lives in the
 * dictionaries under `services.<slug>`, so it can be translated.
 */
import type { Dictionary } from "@/i18n/dictionaries/en";

export const serviceSlugs = [
  "digital-marketing-growth",
  "product-sourcing-logistics",
  "media-content-production",
  "startup-brand-setup",
  "web-ecommerce",
] as const;

export type ServiceSlug = (typeof serviceSlugs)[number];
export type Service = Dictionary["services"][ServiceSlug] & { slug: ServiceSlug };

export function isServiceSlug(value: string): value is ServiceSlug {
  return (serviceSlugs as readonly string[]).includes(value);
}

export function getServices(dict: Dictionary): Service[] {
  return serviceSlugs.map((slug) => ({ slug, ...dict.services[slug] }));
}

export function getService(dict: Dictionary, slug: string): Service | undefined {
  return isServiceSlug(slug) ? { slug, ...dict.services[slug] } : undefined;
}
