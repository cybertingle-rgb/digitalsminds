import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { getServices } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className="relative overflow-x-clip">
      <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-7">
          <p className="glass-ink inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sun-400" />
            {dict.brand.tagline}
          </p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-6xl xl:text-7xl">
            {dict.brand.positioning}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-charcoal-700 text-pretty">{dict.home.heroText}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <LinkButton href={localizePath("/contact", locale)}>{dict.home.heroPrimary}</LinkButton>
            <LinkButton href={localizePath("/services", locale)} variant="secondary">
              {dict.home.heroSecondary}
            </LinkButton>
          </div>
        </div>
        <div className="relative lg:col-span-5">
          <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-sun-400/40 via-sun-200/20 to-charcoal-900/10 blur-2xl" />
          <div className="glass-blur rounded-[2rem] p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">{dict.home.servicesEyebrow}</p>
            <ul className="mt-4 space-y-2">
              {getServices(dict).map((s, i) => (
                <li key={s.slug}>
                  <Link
                    href={localizePath(`/services/${s.slug}`, locale)}
                    className="glow-card group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/55 px-4 py-3.5 hover:bg-white/90"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-charcoal-900 text-sm font-bold text-sun-400" dir="ltr">
                      0{i + 1}
                    </span>
                    <span className="min-w-0 flex-1 font-semibold text-charcoal-900">{s.title}</span>
                    <span aria-hidden="true" className="text-charcoal-600 transition group-hover:translate-x-0.5 rtl:rotate-180">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
