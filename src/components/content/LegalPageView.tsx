import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { hasLocale, localeMeta, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { pageMetadata } from "@/i18n/metadata";
import { getLegalPage, legalPaths, type LegalPage } from "@/modules/content/settings";
import { RichText } from "@/modules/courses/richtext";

async function load(page: LegalPage, lang: string) {
  if (!hasLocale(lang)) return null;
  const p = await getLegalPage(page);
  return p?.published ? { page: p, locale: lang as Locale } : null;
}

export async function legalMetadata(page: LegalPage, lang: string): Promise<Metadata> {
  const r = await load(page, lang);
  if (!r) return { robots: { index: false, follow: false } };
  const title = (r.locale === "ur" && r.page.titleUr) || r.page.title;
  return pageMetadata(r.locale, legalPaths[page], { title });
}

/** Privacy Policy / Terms / Refund Policy page, editable in Admin → Website → Legal pages (404 until published). */
export async function LegalPageView({ page, lang }: { page: LegalPage; lang: string }) {
  const r = await load(page, lang);
  if (!r) notFound();
  const ur = r.locale === "ur" && !!r.page.bodyUr;
  const dict = getDictionary(r.locale);
  const updated = r.page.updatedAt ? new Intl.DateTimeFormat(localeMeta[r.locale].intl, { dateStyle: "long", timeZone: "Asia/Karachi" }).format(new Date(r.page.updatedAt)) : null;
  return (
    <Section>
      <article className="glass-strong mx-auto max-w-3xl rounded-3xl p-6 sm:p-10" dir={ur ? "rtl" : "auto"} lang={ur ? "ur" : undefined}>
        <h1 className="text-3xl font-bold text-charcoal-900 sm:text-4xl">{(r.locale === "ur" && r.page.titleUr) || r.page.title}</h1>
        {updated && <p className="mt-2 text-sm text-muted">{format(dict.legal.updated, { date: updated })}</p>}
        <RichText text={ur ? r.page.bodyUr! : r.page.body} className="mt-8 text-charcoal-800" />
      </article>
    </Section>
  );
}
