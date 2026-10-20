import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ProcessSteps({ dict }: { dict: Dictionary }) {
  return (
    <Section>
      <SectionHeading eyebrow={dict.process.eyebrow} title={dict.process.title} />
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {dict.process.steps.map((s, i) => (
          <li key={i} className="glass glow-card rounded-3xl p-6 sm:p-7">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-200 to-sun-400 text-base font-bold text-charcoal-900 shadow-[0_8px_20px_-8px_rgb(244_192_26/0.9)]">
              {i + 1}
            </span>
            <h3 className="mt-4 font-semibold text-charcoal-900">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
