import type { Metadata } from "next";
import { InquiryForm } from "@/components/forms/InquiryForm";
import { ContactChannels } from "@/components/layout/ContactChannels";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getService } from "@/content/services";

export const metadata: Metadata = {
  title: "Contact",
  description: "Tell us about your business or project and request a consultation with Digitals Minds.",
};

type Props = { searchParams: Promise<{ service?: string | string[] }> };

export default async function ContactPage({ searchParams }: Props) {
  const requested = (await searchParams).service;
  const service = typeof requested === "string" ? getService(requested) : undefined;

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionHeading
            as="h1"
            eyebrow="Contact"
            title="Let's talk about your goals"
            description="Share a few details about your business or project and our team will get back to you with recommended next steps."
          />
          <ContactChannels className="mt-8 text-muted" />
        </div>
        <div className="rounded-2xl border border-line p-6 sm:p-8 lg:col-span-3">
          <InquiryForm defaultService={service?.slug} />
        </div>
      </div>
    </Section>
  );
}
