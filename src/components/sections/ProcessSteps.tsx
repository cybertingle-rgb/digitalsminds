import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  { title: "Tell us your goals", text: "Share where your business is today and where you want it to go." },
  { title: "Get a clear plan", text: "We recommend the services and next steps that fit your stage and budget." },
  { title: "Build and launch", text: "Our divisions work together so strategy, brand and execution stay aligned." },
  { title: "Grow with support", text: "Review progress, learn what works and keep improving." },
];

export function ProcessSteps() {
  return (
    <Section>
      <SectionHeading eyebrow="How we work" title="A simple path from idea to growth" />
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line p-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mt-4 font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
