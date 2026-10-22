import "server-only";
import { cache } from "react";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { LEGAL_EFFECTIVE_DATE, legalDefaults } from "@/content/legal";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { db } from "@/lib/db";
import { IMAGE_MIME_TYPES } from "@/lib/text-search";
import { mediaUrl } from "@/modules/media/service";

/**
 * Website content edited in Admin → Website, stored as SiteSetting rows.
 * Every getter falls back to the built-in text, so the site keeps working
 * when nothing has been edited yet (or the database is unreachable).
 */

const text = (max: number) => z.string().trim().max(max);
const opt = (max: number) => text(max).optional().transform((v) => (v ? v : undefined));

// --- Homepage ------------------------------------------------------------------

export const homeInput = z.object({
  heroTitle: opt(200),
  heroTitleUr: opt(200),
  heroText: opt(600),
  heroTextUr: opt(600),
  whyTitle: opt(200),
  whyTitleUr: opt(200),
  why: z
    .array(z.object({ title: opt(120), titleUr: opt(120), text: opt(400), textUr: opt(400) }))
    .max(4)
    .default([]),
  ctaTitle: opt(200),
  ctaTitleUr: opt(200),
  ctaText: opt(400),
  ctaTextUr: opt(400),
});
export type HomeContent = z.infer<typeof homeInput>;

// --- Contact -------------------------------------------------------------------

export const contactInput = z.object({
  email: z.email("Enter a valid email address").max(254),
  address: z.array(text(120)).max(5),
  addressUr: z.array(text(120)).max(5),
  /** WhatsApp support number; empty = no WhatsApp button. */
  whatsapp: z
    .string()
    .trim()
    .max(24)
    .regex(/^(\+?[\d\s-]{7,22})?$/, "Enter the number with country code, e.g. +92 300 1234567")
    .optional()
    .transform((v) => v || undefined),
});

/** "+92 300 1234567" / "0300 1234567" -> "923001234567" for wa.me links (Pakistan numbers default to +92). */
export function whatsappDigits(v: string | undefined) {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  const full = d.startsWith("0") ? `92${d.slice(1)}` : d;
  return full.length >= 10 && full.length <= 15 ? full : null;
}
export type ContactContent = z.infer<typeof contactInput>;

// --- SEO -----------------------------------------------------------------------

export const seoPages = ["home", "about", "services", "courses", "caseStudies", "blog", "contact"] as const;
export type SeoPage = (typeof seoPages)[number];
export const seoPageLabels: Record<SeoPage, string> = {
  home: "Home",
  about: "About",
  services: "Services",
  courses: "Courses",
  caseStudies: "Case studies",
  blog: "Blog",
  contact: "Contact",
};
const seoEntry = z.object({ title: opt(70), titleUr: opt(70), description: opt(170), descriptionUr: opt(170), imageId: opt(64) });
export const seoInput = z.partialRecord(z.enum(seoPages), seoEntry);
export type SeoContent = z.infer<typeof seoInput>;

// --- Legal pages -----------------------------------------------------------------

export const legalPages = ["privacy", "terms", "refund"] as const;
export type LegalPage = (typeof legalPages)[number];
/** Where each legal page lives on the site. */
export const legalPaths: Record<LegalPage, string> = { privacy: "/privacy", terms: "/terms", refund: "/refund-policy" };
export const legalInput = z.object({
  title: text(200).min(3, "Enter a title"),
  titleUr: opt(200),
  body: text(100_000).min(20, "Paste the page text"),
  bodyUr: opt(100_000),
  published: z.boolean(),
});
export type LegalContent = z.infer<typeof legalInput> & { updatedAt?: string };

// --- Logo ----------------------------------------------------------------------

export const logoInput = z.object({ lightId: z.string().max(64).nullable(), darkId: z.string().max(64).nullable() });
export type LogoSetting = z.infer<typeof logoInput>;
export type Logo = { src: string; width: number; height: number };

// --- Featured course (homepage hero) ---------------------------------------------

/** Internal path (e.g. /contact?service=ebay-course or /courses/ebay) for the hero button. */
const internalPath = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || (/^\/(?![/\\])[^\s\\]*$/.test(v)), "Use a link on this website that starts with /, e.g. /courses/ebay");

export const featuredInput = z.object({
  enabled: z.boolean(),
  eyebrow: opt(80),
  eyebrowUr: opt(80),
  title: opt(200),
  titleUr: opt(200),
  text: opt(600),
  textUr: opt(600),
  points: opt(1200),
  pointsUr: opt(1200),
  price: opt(160),
  priceUr: opt(160),
  button: opt(80),
  buttonUr: opt(80),
  href: internalPath.optional().transform((v) => v || undefined),
  logoId: opt(64),
  disclaimer: opt(300),
  disclaimerUr: opt(300),
});
export type FeaturedContent = z.infer<typeof featuredInput>;

// --- Analytics & Search Console ---------------------------------------------------

/** Accepts the bare code or the whole <meta name="google-site-verification" ...> tag. */
const verificationCode = z
  .string()
  .trim()
  .max(300)
  .transform((v) => v.match(/content=["']([^"']+)["']/)?.[1]?.trim() ?? v)
  .pipe(z.union([z.literal(""), z.string().regex(/^[A-Za-z0-9_-]{10,100}$/, "Paste the code from Search Console (HTML tag method)")]))
  .transform((v) => v || null);

export const analyticsInput = z.object({
  gaId: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.union([z.literal(""), z.string().regex(/^G-[A-Z0-9]{4,20}$/, "A GA4 Measurement ID looks like G-XXXXXXXXXX")]))
    .transform((v) => v || null),
  googleVerification: verificationCode,
});
export type AnalyticsSetting = z.infer<typeof analyticsInput>;

// ---------------------------------------------------------------------------------

const read = cache(async (key: string): Promise<unknown> => {
  try {
    return (await db().siteSetting.findUnique({ where: { key } }))?.value ?? null;
  } catch {
    return null;
  }
});

async function readParsed<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  const parsed = schema.safeParse(await read(key));
  return parsed.success ? parsed.data : null;
}

export async function saveSetting(key: string, value: unknown, actorId: string) {
  const json = JSON.parse(JSON.stringify(value));
  await db().siteSetting.upsert({ where: { key }, create: { key, value: json, updatedById: actorId }, update: { value: json, updatedById: actorId } });
}

export const getHomeContent = () => readParsed("site.home", homeInput);
export const getContactSetting = () => readParsed("site.contact", contactInput);
export const getSeoSetting = async (): Promise<Partial<SeoContent>> => (await readParsed("site.seo", seoInput)) ?? {};
/** Saved page from the admin, or the built-in published text (src/content/legal.ts). */
export async function getLegalPage(page: LegalPage): Promise<(LegalContent & { builtIn: boolean; supersededEdit: boolean }) | null> {
  const saved = await readParsed(`page.${page}`, legalInput.extend({ updatedAt: z.string().optional() }));
  const effective = new Date(`${LEGAL_EFFECTIVE_DATE}T00:00:00+05:00`).getTime();
  // An edit saved before the current built-in version describes an older version of the site, so the newer text wins.
  const superseded = !!saved && !(saved.updatedAt && new Date(saved.updatedAt).getTime() >= effective);
  if (saved && !superseded) return { ...saved, builtIn: false, supersededEdit: false };
  const d = legalDefaults[page];
  return { title: d.title, titleUr: undefined, body: d.body, bodyUr: undefined, published: true, updatedAt: `${LEGAL_EFFECTIVE_DATE}T00:00:00+05:00`, builtIn: true, supersededEdit: superseded };
}
export const getLogoSetting = async () => (await readParsed("site.logo", logoInput)) ?? { lightId: null, darkId: null };
export const getFeaturedSetting = () => readParsed("site.featured", featuredInput);
const storedAnalytics = z.object({ gaId: z.string().nullable(), googleVerification: z.string().nullable() });
export const getAnalyticsSetting = async (): Promise<AnalyticsSetting> =>
  (await readParsed("site.analytics", storedAnalytics)) ?? { gaId: null, googleVerification: null };

const pick = (locale: Locale, en: string | undefined, ur: string | undefined, fallback: string) => (locale === "ur" ? ur || en || fallback : en || fallback);

/** Homepage text in the visitor's language, with the dictionary as fallback. */
export async function homeText(locale: Locale, dict: Dictionary) {
  const h = (await getHomeContent()) ?? homeInput.parse({});
  return {
    heroTitle: pick(locale, h.heroTitle, h.heroTitleUr, dict.brand.positioning),
    heroText: pick(locale, h.heroText, h.heroTextUr, dict.home.heroText),
    whyTitle: pick(locale, h.whyTitle, h.whyTitleUr, dict.home.whyTitle),
    why: dict.home.why.map((d, i) => ({
      title: pick(locale, h.why[i]?.title, h.why[i]?.titleUr, d.title),
      text: pick(locale, h.why[i]?.text, h.why[i]?.textUr, d.text),
    })),
    ctaTitle: pick(locale, h.ctaTitle, h.ctaTitleUr, dict.cta.title),
    ctaText: pick(locale, h.ctaText, h.ctaTextUr, dict.cta.text),
  };
}

/** Email and office address shown on the site. */
export async function contactDetails(locale: Locale, dict: Dictionary) {
  const c = await getContactSetting();
  const address = c ? (locale === "ur" && c.addressUr.some(Boolean) ? c.addressUr : c.address).filter(Boolean) : [];
  return { email: c?.email ?? siteConfig.contact.email, address: address.length ? address : dict.contact.address, whatsapp: whatsappDigits(c?.whatsapp) };
}

/** Search title/description/share image overrides for a page. */
export async function seoFor(page: SeoPage, locale: Locale) {
  const s = (await getSeoSetting())[page];
  if (!s) return {};
  let image: { url: string; width?: number; height?: number } | undefined;
  if (s.imageId) {
    const a = await db()
      .mediaAsset.findUnique({ where: { id: s.imageId } })
      .catch(() => null);
    if (a?.visibility === "PUBLIC") image = { url: mediaUrl(a), width: a.width ?? undefined, height: a.height ?? undefined };
  }
  return {
    title: locale === "ur" ? s.titleUr || s.title : s.title,
    description: locale === "ur" ? s.descriptionUr || s.description : s.description,
    image,
  };
}

/** Current logos (uploaded replacements, or the official files). */
export const getLogos = cache(async (): Promise<{ light: Logo; dark: Logo }> => {
  const s = await getLogoSetting();
  const load = async (id: string | null, fallback: Logo): Promise<Logo> => {
    if (!id) return fallback;
    try {
      const a = await db().mediaAsset.findUnique({ where: { id } });
      if (a && a.visibility === "PUBLIC" && a.mimeType.startsWith("image/") && a.width && a.height) return { src: mediaUrl(a), width: a.width, height: a.height };
    } catch {
      // fall back below
    }
    return fallback;
  };
  const [light, dark] = await Promise.all([load(s.lightId, siteConfig.logo.light), load(s.darkId, siteConfig.logo.dark)]);
  return { light, dark };
});

/** Public images from the Media library, for image pickers. */
export async function publicImages() {
  const rows = await db().mediaAsset.findMany({
    where: { visibility: "PUBLIC", mimeType: { in: IMAGE_MIME_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, originalName: true, storageKey: true, visibility: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.originalName, url: mediaUrl(r) }));
}

/** The featured course shown at the top of the homepage (eBay course by default), or null when switched off. */
export async function featuredText(locale: Locale, dict: Dictionary) {
  const f = (await getFeaturedSetting()) ?? featuredInput.parse({ enabled: true });
  if (!f.enabled) return null;
  const d = dict.featured;
  let logo: { src: string; width: number; height: number; alt: string } | null = null;
  if (f.logoId) {
    const a = await db()
      .mediaAsset.findUnique({ where: { id: f.logoId } })
      .catch(() => null);
    if (a?.visibility === "PUBLIC" && a.mimeType.startsWith("image/") && a.width && a.height) logo = { src: mediaUrl(a), width: a.width, height: a.height, alt: a.altText || d.logoFallback };
  }
  const lines = (v: string) => v.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 8);
  return {
    eyebrow: pick(locale, f.eyebrow, f.eyebrowUr, d.eyebrow),
    title: pick(locale, f.title, f.titleUr, d.title),
    text: pick(locale, f.text, f.textUr, d.text),
    points: lines(pick(locale, f.points, f.pointsUr, "")),
    price: pick(locale, f.price, f.priceUr, d.price),
    button: pick(locale, f.button, f.buttonUr, d.button),
    href: f.href ?? "/contact?service=ebay-course",
    disclaimer: pick(locale, f.disclaimer, f.disclaimerUr, d.disclaimer),
    logo,
  };
}
