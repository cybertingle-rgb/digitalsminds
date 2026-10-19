import type { Metadata } from "next";
import Link from "next/link";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { services } from "@/content/services";

export const metadata: Metadata = {
  title: "Services",
  description: "Digital marketing, product sourcing, media production, startup & brand setup, and web & e-commerce services.",
};

export default function ServicesPage() {
  return (
    <>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow="Services"
          title="Five divisions. One growth partner."
          description="Pick a single service or combine several. We'll recommend the right mix for your stage."
        />
        <nav aria-label="Services" className="mt-8 flex flex-wrap gap-2">
          {services.map((s) => (
            <a key={s.slug} href={`#${s.slug}`} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-brand-200 hover:bg-brand-50">
              {s.shortTitle}
            </a>
          ))}
        </nav>
      </Section>
      {services.map((s, i) => (
        <Section key={s.slug} id={s.slug} tone={i % 2 === 0 ? "alt" : "default"} className="scroll-mt-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{s.title}</h2>
              <p className="mt-4 text-muted">{s.description}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/services/${s.slug}`} className="font-semibold text-brand-700 hover:underline">
                  View details →
                </Link>
                <Link href={`/contact?service=${s.slug}`} className="font-semibold text-brand-700 hover:underline">
                  Request a quote →
                </Link>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {s.offerings.map((o) => (
                <li key={o} className="rounded-lg bg-white p-3 text-sm ring-1 ring-line">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}
      <CtaBanner />
    </>
  );
}
