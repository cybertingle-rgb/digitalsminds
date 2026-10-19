import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export function Hero({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-sun-50 via-white to-white">
      <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-sun-200/50 blur-3xl" />
      <Container className="relative py-20 sm:py-28">
        <p className="inline-flex items-center gap-2 rounded-full bg-charcoal-900 px-4 py-1.5 text-sm font-semibold text-white">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sun-400" />
          {dict.brand.tagline}
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-balance text-charcoal-900 sm:text-6xl">
          {dict.brand.positioning}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted text-pretty">{dict.home.heroText}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <LinkButton href={localizePath("/contact", locale)}>{dict.home.heroPrimary}</LinkButton>
          <LinkButton href={localizePath("/services", locale)} variant="secondary">
            {dict.home.heroSecondary}
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
