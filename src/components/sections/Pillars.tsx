import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

const pillars = [
  { title: "Learn", text: "Build the skills and understanding you need to make confident business decisions." },
  { title: "Grow", text: "Put the right strategy, brand and systems in place to reach more customers." },
  { title: "Earn", text: "Turn growth into sustainable revenue with channels that keep working for you." },
];

export function Pillars() {
  return (
    <Section tone="alt">
      <SectionHeading eyebrow="Our approach" title="Learn | Grow | Earn" align="center" />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {pillars.map((p, i) => (
          <div key={p.title} className="rounded-2xl bg-white p-8 ring-1 ring-line">
            <span className="text-sm font-semibold text-brand-600">0{i + 1}</span>
            <h3 className="mt-2 text-2xl font-bold">{p.title}</h3>
            <p className="mt-3 text-muted">{p.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
