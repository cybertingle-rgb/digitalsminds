import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SocialRow } from "@/components/effects/SocialLinks";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { getServices } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { ContactDetails } from "./ContactDetails";

const linkClass = "rounded-md text-charcoal-700 transition-colors hover:text-charcoal-900 hover:underline underline-offset-4";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  return (
    <footer className="pb-4 pt-8 sm:pt-12">
      <Container>
        <div className="glass relative overflow-hidden rounded-3xl">
          <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 h-64 w-64 rounded-full bg-sun-400/25 blur-3xl" />

          <div className="relative grid gap-10 p-6 text-sm sm:grid-cols-2 sm:p-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <BrandLogo locale={locale} alt={dict.brand.logoAlt} homeLabel={dict.a11y.homeLink} className="h-14 w-auto" />
              <p className="mt-4 flex w-fit items-center gap-2 rounded-full bg-charcoal-900 px-3 py-1 text-xs font-semibold tracking-wide text-white">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sun-400" />
                {dict.brand.tagline}
              </p>
              <p className="mt-3 max-w-xs text-charcoal-700">{dict.brand.positioning}</p>
              <SocialRow label={dict.a11y.social} />
            </div>
            <div className="lg:col-span-3">
              <h2 className="font-semibold text-charcoal-900">{dict.footer.services}</h2>
              <ul className="mt-4 space-y-2.5">
                {getServices(dict).map((s) => (
                  <li key={s.slug}>
                    <Link href={localizePath(`/services/${s.slug}`, locale)} className={linkClass}>{s.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-2">
              <h2 className="font-semibold text-charcoal-900">{dict.footer.company}</h2>
              <ul className="mt-4 space-y-2.5">
                {siteConfig.nav
                  .filter((n) => n.href !== "/")
                  .map((n) => (
                    <li key={n.href}>
                      <Link href={localizePath(n.href, locale)} className={linkClass}>{dict.nav[n.key]}</Link>
                    </li>
                  ))}
                <li>
                  <Link href={localizePath("/account", locale)} className={linkClass}>{dict.nav.myLearning}</Link>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-3">
              <h2 className="font-semibold text-charcoal-900">{dict.footer.contact}</h2>
              <ContactDetails dict={dict} className="mt-4 text-charcoal-700" />
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-charcoal-200/50 px-6 py-5 text-xs text-charcoal-600 sm:px-10">
            <p>{format(dict.footer.copyright, { year: String(year) })}</p>
            <a href="#main" className="font-medium hover:text-charcoal-900">{dict.footer.backToTop} ↑</a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
