import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { siteConfig } from "@/config/site";
import { getServices } from "@/content/services";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/merge";
import { ContactDetails } from "./ContactDetails";

export function SiteFooter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  return (
    // bg matches the official dark-logo background exactly, so the logo blends in.
    <footer className="bg-charcoal-900 text-charcoal-200">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <BrandLogo locale={locale} variant="dark" alt={dict.brand.logoAlt} homeLabel={dict.a11y.homeLink} className="h-16 w-auto" />
          <p className="mt-4 text-sm font-semibold tracking-wide text-sun-400">{dict.brand.tagline}</p>
          <p className="mt-2 max-w-xs text-sm">{dict.brand.positioning}</p>
        </div>
        <div className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">{dict.footer.services}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {getServices(dict).map((s) => (
              <li key={s.slug}>
                <Link href={localizePath(`/services/${s.slug}`, locale)} className="hover:text-sun-400">
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">{dict.footer.company}</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {siteConfig.nav
              .filter((n) => n.href !== "/")
              .map((n) => (
                <li key={n.href}>
                  <Link href={localizePath(n.href, locale)} className="hover:text-sun-400">
                    {dict.nav[n.key]}
                  </Link>
                </li>
              ))}
            {siteConfig.social.map((s) => (
              <li key={s.href}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-sun-400">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-white">{dict.footer.contact}</h2>
          <ContactDetails dict={dict} inverse className="mt-4 text-sm" />
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="py-6 text-xs text-charcoal-300">
          {format(dict.footer.copyright, { year: String(year) })}
        </Container>
      </div>
    </footer>
  );
}
