import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LinkButton } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { features } from "@/config/features";
import { siteConfig } from "@/config/site";
import { localizePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

export function SiteHeader({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = siteConfig.nav.map((n) => ({ label: dict.nav[n.key], href: localizePath(n.href, locale) }));
  const homeHref = localizePath("/", locale);
  const cta = { label: dict.nav.cta, href: localizePath(siteConfig.primaryCtaHref, locale) };
  const switcher = features.urduPublic ? <LanguageSwitcher label={dict.a11y.languageSwitcher} /> : null;
  // Static link (pages stay cacheable): /account sends visitors who aren't signed in to the login page.
  const myLearning = (
    <Link href={localizePath("/account", locale)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-charcoal-900 hover:bg-white/70">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5V6a2 2 0 0 1 2-2h11l3 3v12.5a.5.5 0 0 1-.5.5H6a2 2 0 0 1-2-2Z" />
        <path d="M8 9h8M8 13h6" />
      </svg>
      {dict.nav.myLearning}
    </Link>
  );

  return (
    // Floating frosted bar: sits a little below the top edge and stays visible while scrolling.
    <header className="sticky top-0 z-40 pt-3">
      <Container>
        <div className="glass-blur relative flex h-16 items-center justify-between gap-3 rounded-2xl ps-3 pe-2 sm:h-[4.5rem] sm:ps-4">
        <BrandLogo locale={locale} alt={dict.brand.logoAlt} homeLabel={dict.a11y.homeLink} priority className="h-11 w-auto sm:h-12" />
        <nav aria-label={dict.a11y.mainNav} className="hidden lg:block">
          <NavLinks items={items} homeHref={homeHref} />
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {switcher}
          {myLearning}
          <LinkButton href={cta.href} className="py-2.5">
            {cta.label}
          </LinkButton>
        </div>
        <MobileNav
          items={items}
          homeHref={homeHref}
          cta={cta}
          labels={{ open: dict.a11y.openMenu, close: dict.a11y.closeMenu, nav: dict.a11y.mobileNav }}
          extra={
            <>
              {myLearning}
              {switcher}
            </>
          }
        />
        </div>
      </Container>
    </header>
  );
}
