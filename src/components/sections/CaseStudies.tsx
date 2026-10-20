import Link from "next/link";
import { Arrow } from "@/components/ui/Arrow";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { publishedCaseStudies } from "@/modules/content/items";
import { serviceLabel } from "@/modules/inquiries/labels";
import { mediaUrl } from "@/modules/media/service";

type Item = Awaited<ReturnType<typeof publishedCaseStudies>>[number];

export function CaseStudyCard({ c, locale, dict }: { c: Item; locale: Locale; dict: Dictionary }) {
  const title = (locale === "ur" && c.titleUr) || c.title;
  const summary = (locale === "ur" && c.summaryUr) || c.summary;
  return (
    <Link href={localizePath(`/case-studies/${c.slug}`, locale)} className="glass glow-card group flex h-full flex-col overflow-hidden rounded-3xl">
      <div className="relative aspect-[16/9] bg-gradient-to-br from-sun-200 to-sun-400">
        {c.coverImage?.visibility === "PUBLIC" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(c.coverImage)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">
          {[c.client, c.serviceSlug ? serviceLabel(c.serviceSlug) : null].filter(Boolean).join(" · ")}
        </p>
        <h3 className="mt-2 text-lg font-bold text-charcoal-900" dir="auto">{title}</h3>
        <p className="mt-2 flex-1 text-charcoal-700" dir="auto">{summary}</p>
        <span className="mt-5 text-sm font-semibold text-charcoal-900">{dict.caseStudies.readMore} <Arrow /></span>
      </div>
    </Link>
  );
}

/** Up to three published case studies on the homepage (left out until one is published). */
export async function CaseStudiesTeaser({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = await publishedCaseStudies();
  if (items.length === 0) return null;
  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow={dict.caseStudies.eyebrow} title={dict.caseStudies.title} description={dict.caseStudies.description} />
        <LinkButton href={localizePath("/case-studies", locale)} variant="secondary">{dict.caseStudies.title}</LinkButton>
      </div>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 3).map((c) => <li key={c.id}><CaseStudyCard c={c} locale={locale} dict={dict} /></li>)}
      </ul>
    </Section>
  );
}
