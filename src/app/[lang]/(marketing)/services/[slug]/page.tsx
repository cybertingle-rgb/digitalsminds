import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { JsonLd } from "@/components/seo/JsonLd";
import { getService, getServices, serviceSlugs } from "@/content/services";
import { absolute, breadcrumbs, orgRef } from "@/modules/seo/structured-data";
import { hasLocale, locales, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { pageMetadata } from "@/i18n/metadata";

type Props = PageProps<"/[lang]/services/[slug]">;

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => serviceSlugs.map((slug) => ({ lang, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) return {};
  const service = getService(getDictionary(lang), slug);
  return service ? pageMetadata(lang, `/services/${slug}`, { title: service.title, description: service.summary }) : {};
}

export default async function ServicePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const service = getService(dict, slug);
  if (!service) notFound();

  const quoteHref = `${localizePath("/contact", lang)}?service=${service.slug}`;
  const others = getServices(dict).filter((s) => s.slug !== service.slug);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: service.title,
            description: service.description,
            url: absolute(localizePath(`/services/${service.slug}`, lang)),
            provider: await orgRef(dict),
          },
          breadcrumbs(lang, [
            { name: dict.nav.home, path: "/" },
            { name: dict.nav.services, path: "/services" },
            { name: service.title, path: `/services/${service.slug}` },
          ]),
        ]}
      />
      <Section>
        <nav aria-label={dict.a11y.breadcrumb} className="text-sm text-muted">
          <Link href={localizePath("/services", lang)} className="hover:text-charcoal-900">
            {dict.nav.services}
          </Link>{" "}
          / <span className="text-charcoal-900">{service.title}</span>
        </nav>
        <div className="mt-6">
          <SectionHeading as="h1" title={service.title} description={service.description} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href={quoteHref}>{dict.servicePage.requestQuote}</LinkButton>
          <LinkButton href={localizePath("/services", lang)} variant="secondary">
            {dict.common.allServices}
          </LinkButton>
        </div>
      </Section>
      <Section tone="alt">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-charcoal-900">{dict.servicePage.included}</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {service.offerings.map((o) => (
                <li key={o} className="flex gap-3 glass-subtle rounded-xl p-4">
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun-400 text-xs font-bold text-charcoal-900">
                    ✓
                  </span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-charcoal-900">{dict.servicePage.idealFor}</h2>
            <ul className="mt-6 space-y-3">
              {service.idealFor.map((i) => (
                <li key={i} className="glass-subtle rounded-xl p-4">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <Section>
        <h2 className="text-2xl font-bold text-charcoal-900">{dict.servicePage.explore}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((s) => (
            <li key={s.slug}>
              <Link
                href={localizePath(`/services/${s.slug}`, lang)}
                className="block h-full rounded-xl border border-line p-4 font-semibold text-charcoal-900 hover:border-sun-400 hover:bg-sun-50"
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBanner
        title={format(dict.servicePage.interested, { service: service.title })}
        text={dict.cta.text}
        href={quoteHref}
        label={dict.servicePage.requestQuote}
      />
    </>
  );
}
