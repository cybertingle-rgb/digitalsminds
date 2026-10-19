import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Hero } from "@/components/sections/Hero";
import { Pillars } from "@/components/sections/Pillars";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { ServicesGrid } from "@/components/sections/ServicesGrid";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/i18n/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return pageMetadata(lang, "/", { title: dict.meta.siteTitle, description: dict.meta.description, absoluteTitle: true });
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <>
      <Hero locale={lang} dict={dict} />
      <Section>
        <SectionHeading eyebrow={dict.home.servicesEyebrow} title={dict.home.servicesTitle} description={dict.home.servicesDescription} />
        <div className="mt-12">
          <ServicesGrid locale={lang} dict={dict} />
        </div>
      </Section>
      <Pillars dict={dict} />
      <ProcessSteps dict={dict} />
      <CtaBanner title={dict.cta.title} text={dict.cta.text} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
