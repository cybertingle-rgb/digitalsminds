import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudyCard } from "@/components/sections/CaseStudies";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { publishedCaseStudies } from "@/modules/content/items";
import { editablePageMetadata } from "@/modules/content/metadata";
import { inquiryTopicLabels } from "@/modules/catalog/service";

export async function generateMetadata({ params }: PageProps<"/[lang]/case-studies">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = getDictionary(lang).caseStudies;
  return editablePageMetadata("caseStudies", lang, "/case-studies", { title: t.title, description: t.description });
}

export default async function CaseStudiesPage({ params }: PageProps<"/[lang]/case-studies">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const [items, labels] = await Promise.all([publishedCaseStudies(), inquiryTopicLabels()]);
  return (
    <Section>
      <SectionHeading as="h1" eyebrow={dict.caseStudies.eyebrow} title={dict.caseStudies.title} description={dict.caseStudies.description} />
      {items.length === 0 ? (
        <p className="glass-subtle mt-10 rounded-2xl p-8 text-muted">{dict.caseStudies.empty}</p>
      ) : (
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => <li key={c.id}><CaseStudyCard c={c} locale={lang} dict={dict} labels={labels} /></li>)}
        </ul>
      )}
    </Section>
  );
}
