import Link from "next/link";
import { CookieSettingsButton } from "@/components/analytics/CookieConsent";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SocialRow } from "@/components/effects/SocialLinks";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { getServices } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { publishedCaseStudies } from "@/modules/content/items";
import { getLegalPage } from "@/modules/content/settings";
import { ContactDetails } from "./ContactDetails";
import { NewsletterForm } from "./NewsletterForm";

const linkClass = "rounded-md text-charcoal-700 transition-colors hover:text-charcoal-900 hover:underline underline-offset-4";

export async function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  const [privacy, terms, caseStudies] = await Promise.all([getLegalPage("privacy"), getLegalPage("terms"), publishedCaseStudies()]);
  return (
    <footer className="pb-4 pt-8 sm:pt-12 print:hidden">
      <Container>
        <div className="glass relative overflow-hidden rounded-3xl">
          <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 h-64 w-64 rounded-full bg-sun-400/25 blur-3xl" />

          <div className="relative flex flex-col gap-5 border-b border-charcoal-200/50 bg-gradient-to-r from-sun-100/70 via-white/30 to-transparent p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-xl font-bold text-charcoal-900 sm:text-2xl">{dict.newsletter.title}</p>
              <p className="mt-1 text-sm text-charcoal-700">{dict.newsletter.text}</p>
            </div>
            <NewsletterForm
              locale={locale}
              labels={{ label: dict.newsletter.label, button: dict.newsletter.button, sent: dict.newsletter.sent, invalid: dict.newsletter.invalid, tooMany: dict.newsletter.tooMany, error: dict.newsletter.error }}
            />
          </div>
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
                {caseStudies.length > 0 && (
                  <li>
                    <Link href={localizePath("/case-studies", locale)} className={linkClass}>{dict.caseStudies.title}</Link>
                  </li>
                )}
                <li>
                  <Link href={localizePath("/verify", locale)} className={linkClass}>{dict.certificates.verifyTitle}</Link>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-3">
              <h2 className="font-semibold text-charcoal-900">{dict.footer.contact}</h2>
              <ContactDetails dict={dict} locale={locale} className="mt-4 text-charcoal-700" />
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-charcoal-200/50 px-6 py-5 text-xs text-charcoal-600 sm:px-10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p>{format(dict.footer.copyright, { year: String(year) })}</p>
              {privacy?.published && <Link href={localizePath("/privacy", locale)} className="hover:text-charcoal-900 hover:underline">{dict.legal.privacy}</Link>}
              {terms?.published && <Link href={localizePath("/terms", locale)} className="hover:text-charcoal-900 hover:underline">{dict.legal.terms}</Link>}
              <CookieSettingsButton label={dict.legal.cookieSettings} className="hover:text-charcoal-900 hover:underline" />
            </div>
            <a href="#main" className="font-medium hover:text-charcoal-900">{dict.footer.backToTop} ↑</a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
