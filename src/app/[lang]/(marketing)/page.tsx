import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { CaseStudiesTeaser } from "@/components/sections/CaseStudies";
import { Faq } from "@/components/sections/Faq";
import { HomeCourses } from "@/components/sections/HomeCourses";
import { Testimonials } from "@/components/sections/Testimonials";
import { WhyUs } from "@/components/sections/WhyUs";
import { Hero } from "@/components/sections/Hero";
import { Pillars } from "@/components/sections/Pillars";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { ServicesGrid } from "@/components/sections/ServicesGrid";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { homeText } from "@/modules/content/settings";
import { editablePageMetadata } from "@/modules/content/metadata";

// Published courses and testimonials come from the database; refreshed every 5 minutes.
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return editablePageMetadata("home", lang, "/", { title: dict.meta.siteTitle, description: dict.meta.description, absoluteTitle: true });
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const h = await homeText(lang, dict);
  return (
    <>
      <Hero locale={lang} dict={dict} />
      <Section>
        <SectionHeading eyebrow={dict.home.servicesEyebrow} title={dict.home.servicesTitle} description={dict.home.servicesDescription} />
        <div className="mt-12">
          <ServicesGrid locale={lang} dict={dict} detailed />
        </div>
      </Section>
      <WhyUs locale={lang} dict={dict} />
      <HomeCourses locale={lang} dict={dict} />
      <Pillars dict={dict} />
      <ProcessSteps dict={dict} />
      <Testimonials locale={lang} dict={dict} />
      <CaseStudiesTeaser locale={lang} dict={dict} />
      <Faq locale={lang} dict={dict} />
      <CtaBanner title={h.ctaTitle} text={h.ctaText} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
