import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dictionary } from "@/i18n/get-dictionary";

export function ProcessSteps({ dict }: { dict: Dictionary }) {
  return (
    <Section>
      <SectionHeading eyebrow={dict.process.eyebrow} title={dict.process.title} />
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {dict.process.steps.map((s, i) => (
          <li key={i} className="glass rounded-2xl p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun-400 text-sm font-bold text-charcoal-900">
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
