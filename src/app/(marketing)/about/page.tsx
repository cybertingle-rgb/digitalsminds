import type { Metadata } from "next";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Pillars } from "@/components/sections/Pillars";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { siteConfig } from "@/config/site";
import { services } from "@/content/services";

export const metadata: Metadata = {
  title: "About",
  description: `About ${siteConfig.name}: ${siteConfig.positioning}.`,
};

export default function AboutPage() {
  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow={`About ${siteConfig.name}`}
          title={siteConfig.positioning}
          description={
            <>
              <p>
                {siteConfig.name} brings together the services a business needs to start, grow and scale: from
                building a brand and sourcing products to marketing, content and online sales.
              </p>
              <p className="mt-4">
                Our guiding idea is <strong className="text-ink">{siteConfig.tagline}</strong>: help people gain the
                knowledge to make good decisions, put growth systems in place, and turn that growth into income.
              </p>
            </>
          }
        />
      </Section>
      <Pillars />
      <Section>
        <SectionHeading title="Our divisions" description="Each division is a specialist team, and they work as one." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.slug} className="rounded-xl border border-line p-5">
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.summary}</p>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBanner title="Let's build something together" />
    </>
  );
}
