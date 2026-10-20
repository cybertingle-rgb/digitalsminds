import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { db } from "@/lib/db";
import { mediaUrl } from "@/modules/media/service";

async function loadTestimonials() {
  try {
    return await db().testimonial.findMany({
      where: { published: true, consentConfirmed: true },
      orderBy: [{ featured: "desc" }, { position: "asc" }],
      take: 9,
      include: { photo: { select: { id: true, storageKey: true, visibility: true } } },
    });
  } catch {
    // Database unavailable (e.g. during a build): leave the section out.
    return [];
  }
}

/** Published testimonials with confirmed consent only; nothing is shown until there are some. */
export async function Testimonials({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = await loadTestimonials();
  if (items.length === 0) return null;
  return (
    <Section tone="alt">
      <SectionHeading eyebrow={dict.home.testimonialsEyebrow} title={dict.home.testimonialsTitle} align="center" />
      <ul className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((t) => (
          <li key={t.id} className="glass glow-card flex flex-col rounded-3xl p-7">
            <span aria-hidden="true" className="text-5xl font-bold leading-none text-sun-400">“</span>
            <blockquote className="mt-2 flex-1 text-charcoal-800" dir="auto">{(locale === "ur" && t.quoteUr) || t.quote}</blockquote>
            <div className="mt-6 flex items-center gap-3">
              {t.photo?.visibility === "PUBLIC" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(t.photo)} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white" />
              )}
              <div>
                <p className="font-semibold text-charcoal-900" dir="auto">{t.name}</p>
                {(t.roleTitle || t.company) && <p className="text-sm text-muted" dir="auto">{[t.roleTitle, t.company].filter(Boolean).join(", ")}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
