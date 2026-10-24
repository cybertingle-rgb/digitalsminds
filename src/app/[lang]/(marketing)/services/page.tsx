import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Arrow } from "@/components/ui/Arrow";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { hasLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { siteServices } from "@/modules/catalog/service";
import { homeText } from "@/modules/content/settings";
import { editablePageMetadata } from "@/modules/content/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/services">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return editablePageMetadata("services", lang, "/services", { title: dict.nav.services, description: dict.servicesPage.metaDescription });
}

export default async function ServicesPage({ params }: PageProps<"/[lang]/services">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const [h, services] = await Promise.all([homeText(lang, dict), siteServices()]);
  return (
    <>
      <Section>
        <SectionHeading as="h1" eyebrow={dict.servicesPage.eyebrow} title={dict.servicesPage.title} description={dict.servicesPage.description} />
        <nav aria-label={dict.nav.services} className="mt-8 flex flex-wrap gap-2">
          {services.map((s) => (
            <a
              key={s.slug}
              href={`#${s.slug}`}
              className="rounded-full border border-charcoal-200 px-4 py-1.5 text-sm hover:border-sun-400 hover:bg-sun-50"
            >
              {s.shortTitle}
            </a>
          ))}
        </nav>
      </Section>
      {services.map((s, i) => (
        <Section key={s.slug} id={s.slug} tone={i % 2 === 0 ? "alt" : "default"} className="scroll-mt-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-charcoal-900 sm:text-3xl">{s.title}</h2>
              {s.category && <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gold-700">{s.category.title}</p>}
              <p className="mt-4 text-muted">{s.description}</p>
              {s.notice && <p className="mt-4 rounded-xl border-s-4 border-sun-400 bg-white/60 px-4 py-3 text-sm text-charcoal-800">{s.notice}</p>}
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                <Link href={localizePath(`/services/${s.slug}`, lang)} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">
                  {dict.common.viewDetails} <Arrow />
                </Link>
                <Link href={`${localizePath("/contact", lang)}?service=${s.slug}`} className="font-semibold text-charcoal-900 underline-offset-4 hover:underline">
                  {dict.common.requestQuote} <Arrow />
                </Link>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {s.offerings.map((o) => (
                <li key={o} className="glass-subtle rounded-xl p-3 text-sm">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}
      <CtaBanner title={h.ctaTitle} text={h.ctaText} label={dict.cta.label} href={localizePath("/contact", lang)} />
    </>
  );
}
