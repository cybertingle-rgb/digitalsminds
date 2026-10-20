import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dictionary } from "@/i18n/get-dictionary";

const icons = [
  // grid, rocket-ish arrow, book, map pin
  "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  "M5 19 19 5M19 5h-8M19 5v8",
  "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5",
  "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
];

export function WhyUs({ dict }: { dict: Dictionary }) {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow={dict.home.whyEyebrow} title={dict.home.whyTitle} description={dict.brand.positioning} />
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:col-span-8">
          {dict.home.why.map((w, i) => (
            <li key={w.title} className="glass glow-card rounded-3xl p-6 sm:p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-sun-100 text-charcoal-900 ring-1 ring-white shadow-[0_8px_20px_-10px_rgb(244_192_26/0.9)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icons[i % icons.length]} />
                </svg>
              </span>
              <h3 className="mt-5 text-lg font-bold text-charcoal-900">{w.title}</h3>
              <p className="mt-2 text-charcoal-700">{w.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
