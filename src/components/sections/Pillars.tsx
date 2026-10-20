import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Pillars({ dict }: { dict: Dictionary }) {
  return (
    <Section tone="alt">
      <SectionHeading eyebrow={dict.pillars.eyebrow} title={dict.brand.tagline} align="center" />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {dict.pillars.items.map((p, i) => (
          <div key={i} className="glass rounded-3xl !border-t-4 !border-t-sun-400 p-8">
            <span className="text-sm font-semibold text-gold-700" dir="ltr">0{i + 1}</span>
            <h3 className="mt-2 text-2xl font-bold text-charcoal-900">{p.title}</h3>
            <p className="mt-3 text-muted">{p.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
