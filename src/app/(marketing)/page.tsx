import { CtaBanner } from "@/components/sections/CtaBanner";
import { Hero } from "@/components/sections/Hero";
import { Pillars } from "@/components/sections/Pillars";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { ServicesGrid } from "@/components/sections/ServicesGrid";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Section>
        <SectionHeading
          eyebrow="What we do"
          title="Everything your business needs to grow"
          description="Five specialist divisions working together, so you don't have to coordinate multiple agencies."
        />
        <div className="mt-12">
          <ServicesGrid />
        </div>
      </Section>
      <Pillars />
      <ProcessSteps />
      <CtaBanner />
    </>
  );
}
