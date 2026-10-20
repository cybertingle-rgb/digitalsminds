import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { publicFaqs } from "@/modules/content/items";

/** Accordion of common questions (native <details>, works without JavaScript). */
export async function Faq({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const faqs = await publicFaqs(locale, dict);
  if (faqs.length === 0) return null;
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow={dict.home.faqEyebrow} title={dict.home.faqTitle} />
        </div>
        <div className="space-y-3 lg:col-span-8">
          {faqs.map((f) => (
            <details key={f.q} className="glass glow-card group rounded-2xl p-5 open:!border-sun-400/70 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-charcoal-900 [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl leading-none ring-1 ring-white transition-transform duration-300 group-open:rotate-45 group-open:bg-sun-400">+</span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-charcoal-700" dir="auto">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
