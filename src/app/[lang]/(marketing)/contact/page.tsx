import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InquiryForm } from "@/components/forms/InquiryForm";
import { ContactDetails } from "@/components/layout/ContactDetails";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getServices, isServiceSlug } from "@/content/services";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { pageMetadata } from "@/i18n/metadata";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = getDictionary(lang);
  return pageMetadata(lang, "/contact", { title: dict.nav.contact, description: dict.contact.metaDescription });
}

export default async function ContactPage({ params, searchParams }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const requested = (await searchParams).service;
  const defaultService = typeof requested === "string" && isServiceSlug(requested) ? requested : undefined;

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionHeading as="h1" eyebrow={dict.contact.eyebrow} title={dict.contact.title} description={dict.contact.description} />
          <ContactDetails dict={dict} className="mt-10 glass-subtle rounded-2xl p-6 text-muted" />
        </div>
        <div className="glass-strong rounded-3xl !border-t-4 !border-t-sun-400 p-6 sm:p-8 lg:col-span-3">
          <InquiryForm
            strings={dict.form}
            services={getServices(dict).map((s) => ({ slug: s.slug, title: s.title }))}
            defaultService={defaultService}
          />
        </div>
      </div>
    </Section>
  );
}
