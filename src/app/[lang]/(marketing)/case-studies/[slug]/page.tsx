import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Section } from "@/components/ui/Section";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/i18n/metadata";
import { caseStudyBySlug } from "@/modules/content/items";
import { homeText } from "@/modules/content/settings";
import { RichText } from "@/modules/courses/richtext";
import { serviceLabel } from "@/modules/inquiries/labels";
import { mediaUrl } from "@/modules/media/service";

type Props = PageProps<"/[lang]/case-studies/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const c = await caseStudyBySlug(slug);
  if (!c) return { robots: { index: false, follow: false } };
  return pageMetadata(lang, `/case-studies/${slug}`, {
    title: (lang === "ur" && c.titleUr) || c.title,
    description: (lang === "ur" && c.summaryUr) || c.summary,
    image: c.coverImage?.visibility === "PUBLIC" ? { url: mediaUrl(c.coverImage), width: c.coverImage.width ?? undefined, height: c.coverImage.height ?? undefined } : undefined,
  });
}

export default async function CaseStudyPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const c = await caseStudyBySlug(slug);
  if (!c) notFound();
  const dict = getDictionary(lang);
  const h = await homeText(lang, dict);
  const ur = lang === "ur" && !!c.bodyUr;
  return (
    <>
      <Section>
        <nav aria-label={dict.a11y.breadcrumb} className="text-sm text-muted">
          <Link href={localizePath("/case-studies", lang)} className="hover:text-charcoal-900">{dict.caseStudies.back}</Link>
        </nav>
        <article className="mt-6 grid gap-10 lg:grid-cols-12">
          <header className="lg:col-span-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">
              {[c.client, c.serviceSlug ? serviceLabel(c.serviceSlug) : null].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-5xl" dir="auto">{(lang === "ur" && c.titleUr) || c.title}</h1>
            <p className="mt-5 text-lg text-charcoal-700" dir="auto">{(lang === "ur" && c.summaryUr) || c.summary}</p>
            {c.coverImage?.visibility === "PUBLIC" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(c.coverImage)} alt={c.coverImage.altText ?? ""} className="mt-8 w-full rounded-3xl ring-1 ring-white" />
            )}
          </header>
          <div className="glass-strong rounded-3xl p-6 sm:p-10 lg:col-span-7" dir={ur ? "rtl" : "auto"} lang={ur ? "ur" : undefined}>
            <RichText text={ur ? c.bodyUr! : c.body} className="text-charcoal-800" />
          </div>
        </article>
      </Section>
      <CtaBanner title={h.ctaTitle} text={h.ctaText} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
