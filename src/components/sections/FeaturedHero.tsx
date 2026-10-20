import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { featuredText } from "@/modules/content/settings";

type Featured = NonNullable<Awaited<ReturnType<typeof featuredText>>>;

/** Homepage hero for the featured course (the eBay course). Edited in Admin → Website → Homepage. */
export function FeaturedHero({ locale, dict, f }: { locale: Locale; dict: Dictionary; f: Featured }) {
  return (
    <section className="relative overflow-x-clip" aria-labelledby="featured-title">
      <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-7">
          {f.logo && (
            // Phones: show the logo first; the large card with the same logo comes after the text.
            <Image src={f.logo.src} alt="" width={f.logo.width} height={f.logo.height} priority className="mb-6 h-12 w-auto lg:hidden" />
          )}
          <p className="glass-ink inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-sun-400 motion-reduce:animate-none" />
            {f.eyebrow}
          </p>
          <h1 id="featured-title" className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-6xl xl:text-7xl" dir="auto">
            {f.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-charcoal-700 text-pretty" dir="auto">{f.text}</p>
          <p className="glass-subtle mt-6 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold text-charcoal-800" dir="auto">{f.price}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={localizePath(f.href, locale)} className="border-run">{f.button}</LinkButton>
            <LinkButton href={localizePath("/services", locale)} variant="secondary">{dict.featured.secondary}</LinkButton>
          </div>
        </div>
        <div className="relative lg:col-span-5">
          <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-sun-400/45 via-sun-200/25 to-charcoal-900/10 blur-2xl" />
          <div className="glass-blur border-run-live rounded-[2rem] p-5 sm:p-7">
            <div className="flex min-h-40 items-center justify-center rounded-3xl bg-white/90 px-8 py-10 ring-1 ring-white sm:min-h-48">
              {f.logo ? (
                <Image src={f.logo.src} alt={f.logo.alt} width={f.logo.width} height={f.logo.height} priority className="h-auto max-h-32 w-auto max-w-full object-contain sm:max-h-36" />
              ) : (
                <span className="text-7xl font-bold tracking-tight text-charcoal-900 sm:text-8xl" dir="ltr">{dict.featured.logoFallback}</span>
              )}
            </div>
            {f.points.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">{dict.featured.pointsTitle}</p>
                <ul className="mt-3 space-y-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/55 px-4 py-3 text-charcoal-900" dir="auto">
                      <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charcoal-900 text-xs font-bold text-sun-400">✓</span>
                      <span className="font-medium">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-charcoal-600" dir="auto">{f.disclaimer}</p>
        </div>
      </Container>
    </section>
  );
}
