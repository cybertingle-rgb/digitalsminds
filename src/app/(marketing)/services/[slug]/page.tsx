import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBanner } from "@/components/sections/CtaBanner";
import { LinkButton } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getService, services } from "@/content/services";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = getService((await params).slug);
  return service ? { title: service.title, description: service.summary } : {};
}

export default async function ServicePage({ params }: Props) {
  const service = getService((await params).slug);
  if (!service) notFound();

  const others = services.filter((s) => s.slug !== service.slug);

  return (
    <>
      <Section>
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/services" className="hover:text-ink">
            Services
          </Link>{" "}
          / <span className="text-ink">{service.title}</span>
        </nav>
        <div className="mt-6">
          <SectionHeading as="h1" title={service.title} description={service.description} />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton href={`/contact?service=${service.slug}`}>Request a Quote</LinkButton>
          <LinkButton href="/services" variant="secondary">
            All Services
          </LinkButton>
        </div>
      </Section>
      <Section tone="alt">
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold">What&apos;s included</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {service.offerings.map((o) => (
                <li key={o} className="flex gap-3 rounded-lg bg-white p-4 ring-1 ring-line">
                  <span aria-hidden="true" className="text-brand-600">✓</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Ideal for</h2>
            <ul className="mt-6 space-y-3">
              {service.idealFor.map((i) => (
                <li key={i} className="rounded-lg bg-white p-4 ring-1 ring-line">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <Section>
        <h2 className="text-2xl font-bold">Explore other divisions</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((s) => (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}`} className="block h-full rounded-xl border border-line p-4 hover:border-brand-200 hover:bg-brand-50">
                <span className="font-semibold">{s.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBanner title={`Interested in ${service.title}?`} href={`/contact?service=${service.slug}`} label="Request a Quote" />
    </>
  );
}
