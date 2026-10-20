import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Pillars } from "@/components/sections/Pillars";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getServices } from "@/content/services";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { homeText } from "@/modules/content/settings";
import { editablePageMetadata } from "@/modules/content/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return editablePageMetadata("about", lang, "/about", { title: dict.nav.about, description: dict.about.metaDescription });
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const h = await homeText(lang, dict);
  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow={dict.about.eyebrow}
          title={dict.brand.positioning}
          description={
            <>
              <p>{dict.about.intro}</p>
              <p className="mt-4">{dict.about.philosophy}</p>
            </>
          }
        />
      </Section>
      <Pillars dict={dict} />
      <Section>
        <SectionHeading title={dict.about.divisionsTitle} description={dict.about.divisionsDescription} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {getServices(dict).map((s) => (
            <li key={s.slug} className="glass glow-card rounded-2xl !border-s-4 !border-s-sun-400 p-5">
              <h3 className="font-semibold text-charcoal-900">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.summary}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBanner title={dict.about.ctaTitle} text={h.ctaText} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
